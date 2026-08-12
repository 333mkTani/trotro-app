jest.mock('../../models/booking.model');
jest.mock('../../models/code.model');
jest.mock('../../models/bus.model');
jest.mock('../../models/rating.model');
jest.mock('../../models/driver.model');
jest.mock('../../models/profile.model');
jest.mock('../../models/bookingPayment.model');
jest.mock('../../models/wallet.model');
jest.mock('../push.service', () => ({ send: jest.fn() }));
jest.mock('../refund.service', () => ({ initiateForBooking: jest.fn() }));
jest.mock('../../realtime/io', () => ({
  emitToDriver: jest.fn(),
  emitToRoute: jest.fn(),
  emitToUser: jest.fn(),
}));
jest.mock('../../config/db', () => ({
  withTransaction: jest.fn((fn) => fn({ fakeClient: true })),
}));
jest.mock('../../utils/codes', () => ({
  generateBoardingCode: jest.fn(() => '123456'),
  buildQrPayload: jest.fn(() => 'qr-payload'),
}));

const bookingModel = require('../../models/booking.model');
const codeModel = require('../../models/code.model');
const busModel = require('../../models/bus.model');
const profileModel = require('../../models/profile.model');
const paymentModel = require('../../models/bookingPayment.model');
const walletModel = require('../../models/wallet.model');
const { emitToDriver } = require('../../realtime/io');
const bookingService = require('../booking.service');

describe('legacy booking creation is payment-gated', () => {
  const data = {
    driverId: 'driver-1',
    busId: 'bus-1',
    routeId: 'route-1',
    pickupStopId: 'pickup-1',
    pickupStopName: 'Pickup',
    destinationStopId: 'destination-1',
    destinationStopName: 'Destination',
    desiredArrivalTime: '2026-08-08T08:00:00.000Z',
    bufferMinutes: 10,
  };
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects the legacy endpoint before inserting or reserving a seat', async () => {
    await expect(bookingService.create('passenger-1', data)).rejects.toThrow(
      'A verified deposit is required',
    );
    expect(bookingModel.insert).not.toHaveBeenCalled();
    expect(busModel.reserveSeatForAutoAccept).not.toHaveBeenCalled();
    expect(codeModel.insert).not.toHaveBeenCalled();
  });
});

describe('confirmation requires a verified deposit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not reserve a seat or issue a code for an unpaid pending booking', async () => {
    bookingModel.findById.mockResolvedValue({
      id: 'booking-1', status: 'pending', payment_status: 'unpaid', driver_id: 'driver-1',
    });

    await expect(bookingService.confirm('booking-1', { driverId: 'driver-1' }))
      .rejects.toThrow('A verified deposit is required');
    expect(busModel.reserveSeat).not.toHaveBeenCalled();
    expect(codeModel.insert).not.toHaveBeenCalled();
  });
});

describe('boarding verification opens balance collection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the code once and moves a deposit-backed booking to balance pending', async () => {
    codeModel.findByCode.mockResolvedValue({
      id: 'code-1', booking_id: 'booking-1', status: 'valid',
      valid_until: '2099-01-01T00:00:00Z',
    });
    bookingModel.findByIdForUpdate.mockResolvedValue({
      id: 'booking-1', passenger_id: 'passenger-1', driver_id: 'driver-1',
      payment_status: 'deposit_paid',
    });
    codeModel.markUsed.mockResolvedValue({ id: 'code-1', status: 'used' });
    bookingModel.markBoardedAndOpenBalance.mockResolvedValue({
      id: 'booking-1', passenger_id: 'passenger-1', driver_id: 'driver-1',
      payment_status: 'balance_pending', remaining_balance: '7.50',
    });
    profileModel.findById.mockResolvedValue(null);

    const result = await bookingService.redeemCode('123456', { id: 'driver-1', role: 'driver' });

    expect(codeModel.markUsed).toHaveBeenCalledWith('code-1', expect.anything());
    expect(bookingModel.markBoardedAndOpenBalance).toHaveBeenCalledWith('booking-1', expect.anything());
    expect(result.booking.payment_status).toBe('balance_pending');
  });

  it('does not board when the atomic code update reports a replay', async () => {
    codeModel.findByCode.mockResolvedValue({
      id: 'code-1', booking_id: 'booking-1', status: 'valid',
      valid_until: '2099-01-01T00:00:00Z',
    });
    bookingModel.findByIdForUpdate.mockResolvedValue({
      id: 'booking-1', passenger_id: 'passenger-1', driver_id: 'driver-1',
      payment_status: 'deposit_paid',
    });
    codeModel.markUsed.mockResolvedValue(null);

    await expect(bookingService.redeemCode('123456', { id: 'driver-1', role: 'driver' }))
      .rejects.toThrow('Code is already used');
    expect(bookingModel.markBoardedAndOpenBalance).not.toHaveBeenCalled();
  });

  it('does not consume a valid code when the booking has no verified deposit', async () => {
    codeModel.findByCode.mockResolvedValue({
      id: 'code-1', booking_id: 'booking-1', status: 'valid',
      valid_until: '2099-01-01T00:00:00Z',
    });
    bookingModel.findByIdForUpdate.mockResolvedValue({
      id: 'booking-1', passenger_id: 'passenger-1', driver_id: 'driver-1',
      payment_status: 'unpaid',
    });

    await expect(bookingService.redeemCode('123456', { id: 'driver-1', role: 'driver' }))
      .rejects.toThrow('A verified deposit is required');
    expect(codeModel.markUsed).not.toHaveBeenCalled();
    expect(bookingModel.markBoardedAndOpenBalance).not.toHaveBeenCalled();
  });
});

describe('booking cancellation, expiry, and seat release', () => {
  const base = {
    id: 'booking-1', passenger_id: 'passenger-1', driver_id: 'driver-1',
    bus_id: 'bus-1', status: 'confirmed', boarded_at: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    codeModel.findByBookingId.mockResolvedValue({ id: 'code-1', status: 'valid' });
  });

  it('atomically cancels an unboarded booking and releases its confirmed seat once', async () => {
    bookingModel.findByIdForUpdate.mockResolvedValue(base);
    bookingModel.cancelForUser.mockResolvedValue({
      ...base, status: 'cancelled', previous_status: 'confirmed', refund_due: true,
      payment_status: 'refund_pending',
    });

    const result = await bookingService.cancel('booking-1', { id: 'passenger-1', role: 'passenger' });

    expect(result).toMatchObject({ status: 'cancelled', payment_status: 'refund_pending' });
    expect(busModel.adjustSeats).toHaveBeenCalledTimes(1);
    expect(busModel.adjustSeats).toHaveBeenCalledWith('bus-1', 1, expect.anything());
    expect(codeModel.invalidate).toHaveBeenCalledWith('code-1', expect.anything());
  });

  it('rejects cancellation after boarding and never releases the occupied seat', async () => {
    bookingModel.findByIdForUpdate.mockResolvedValue({ ...base, boarded_at: new Date().toISOString() });
    await expect(bookingService.cancel('booking-1', {
      id: 'passenger-1', role: 'passenger',
    })).rejects.toThrow('cannot be cancelled after boarding');
    expect(bookingModel.cancelForUser).not.toHaveBeenCalled();
    expect(busModel.adjustSeats).not.toHaveBeenCalled();
  });

  it('expires holds without increasing physical seats and releases confirmed no-show seats', async () => {
    bookingModel.expireDue.mockResolvedValue([
      { ...base, id: 'hold-1', status: 'expired', previous_status: 'pending', bus_id: 'bus-1' },
      { ...base, id: 'no-show-1', status: 'expired', previous_status: 'confirmed', bus_id: 'bus-1' },
    ]);
    codeModel.findByBookingId.mockResolvedValue(null);

    await expect(bookingService.expireStale()).resolves.toHaveLength(2);
    expect(busModel.adjustSeats).toHaveBeenCalledTimes(1);
    expect(busModel.adjustSeats).toHaveBeenCalledWith('bus-1', 1, expect.anything());
  });

  it('credits the deposit to an eligible driver exactly through auditable ledgers', async () => {
    bookingModel.expireDue.mockResolvedValue([{
      ...base, status: 'expired', previous_status: 'confirmed',
      payment_status: 'deposit_paid', deposit_amount: '2.50',
      driver_pickup_arrived_at: '2026-08-12T07:55:00Z',
      boarding_deadline: '2026-08-12T08:10:00Z', pickup_stop_name: 'Tech Junction',
    }]);
    codeModel.findByBookingId.mockResolvedValue(null);
    bookingModel.markNoShowCompensated.mockResolvedValue({
      ...base, status: 'expired', payment_status: 'deposit_forfeited',
      no_show_compensation_amount: '2.50', no_show_compensated_at: '2026-08-12T08:11:00Z',
    });
    paymentModel.insert.mockResolvedValue({ id: 'comp-ledger-1' });
    walletModel.ensureWallet.mockResolvedValue({ user_id: 'driver-1', balance: '0' });
    walletModel.adjustBalance.mockResolvedValue({ user_id: 'driver-1', balance: '2.50' });
    walletModel.insertTransaction.mockResolvedValue({ id: 'wallet-tx-1' });

    const [result] = await bookingService.expireStale();

    expect(paymentModel.insert).toHaveBeenCalledWith(expect.objectContaining({
      type: 'no_show_compensation', amount: 2.5,
      idempotencyKey: 'no-show-compensation:booking-1',
    }), expect.anything());
    expect(walletModel.adjustBalance).toHaveBeenCalledWith('driver-1', 2.5, expect.anything());
    expect(walletModel.insertTransaction).toHaveBeenCalledWith(expect.objectContaining({
      type: 'no_show_compensation', reference: 'NOSHOW_booking-1_CREDIT',
    }), expect.anything());
    expect(result.payment_status).toBe('deposit_forfeited');
  });

  it('does not compensate without recorded GPS arrival at the pickup stop', async () => {
    bookingModel.expireDue.mockResolvedValue([{
      ...base, status: 'expired', previous_status: 'confirmed',
      payment_status: 'deposit_paid', deposit_amount: '2.50',
      driver_pickup_arrived_at: null,
    }]);
    codeModel.findByBookingId.mockResolvedValue(null);
    await bookingService.expireStale();
    expect(paymentModel.insert).not.toHaveBeenCalled();
    expect(walletModel.adjustBalance).not.toHaveBeenCalled();
  });
});
