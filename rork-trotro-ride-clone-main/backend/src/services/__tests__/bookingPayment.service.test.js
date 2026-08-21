jest.mock('../../models/booking.model');
jest.mock('../../models/bookingPayment.model');
jest.mock('../../models/profile.model');
jest.mock('../../models/bus.model');
jest.mock('../../models/code.model');
jest.mock('../../models/wallet.model');
jest.mock('../paystack.service');
jest.mock('../push.service', () => ({ send: jest.fn() }));
jest.mock('../refund.service', () => ({ initiateForBooking: jest.fn() }));
jest.mock('../../realtime/io', () => ({ emitToDriver: jest.fn(), emitToUser: jest.fn() }));
jest.mock('../../utils/codes', () => ({
  generateBoardingCode: jest.fn(() => '123456'),
  buildQrPayload: jest.fn(() => 'qr-payload'),
}));
jest.mock('../../config/db', () => ({
  withTransaction: jest.fn((fn) => fn({ fakeClient: true })),
}));

const bookingModel = require('../../models/booking.model');
const paymentModel = require('../../models/bookingPayment.model');
const profileModel = require('../../models/profile.model');
const busModel = require('../../models/bus.model');
const codeModel = require('../../models/code.model');
const walletModel = require('../../models/wallet.model');
const paystackService = require('../paystack.service');
const service = require('../bookingPayment.service');

describe('booking deposit payment initialization and verification', () => {
  const booking = {
    id: 'booking-1', passenger_id: 'passenger-1', driver_id: 'driver-1', bus_id: 'bus-1',
    status: 'pending', pickup_stop_name: 'Pickup', destination_stop_name: 'Destination',
    payment_status: 'deposit_pending', deposit_amount: '2.50',
    hold_expires_at: '2099-08-12T08:00:00.000Z',
  };
  const payment = {
    id: 'payment-1', booking_id: 'booking-1', passenger_id: 'passenger-1',
    type: 'deposit', amount: '2.50', currency: 'GHS', status: 'initiated',
    provider: 'paystack', provider_reference: 'DEP_booking_abc',
    authorization_url: null, access_code: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    bookingModel.findProvisionalForPaymentForUpdate.mockResolvedValue(booking);
    paymentModel.findByIdempotencyKeyForUpdate.mockResolvedValue(null);
    paymentModel.findActiveDepositForBookingForUpdate.mockResolvedValue(null);
    paymentModel.findActiveBalanceForBookingForUpdate.mockResolvedValue(null);
    paymentModel.insert.mockResolvedValue(payment);
    profileModel.findById.mockResolvedValue({ id: 'passenger-1', email: 'passenger@example.com' });
    paystackService.initializeTransaction.mockResolvedValue({
      authorization_url: 'https://checkout.paystack.test/abc', access_code: 'access-1',
    });
    paymentModel.markInitialized.mockResolvedValue({
      ...payment, status: 'pending',
      authorization_url: 'https://checkout.paystack.test/abc', access_code: 'access-1',
    });
    bookingModel.findByIdForUpdate.mockResolvedValue(booking);
    codeModel.findByBookingId.mockResolvedValue({ code: '123456', qr_payload: 'qr-payload' });
    busModel.reserveSeatForPaidBooking.mockResolvedValue({ id: 'bus-1', seats_available: 3 });
    bookingModel.confirmAfterDeposit.mockResolvedValue({
      ...booking, status: 'confirmed', payment_status: 'deposit_paid',
    });
    codeModel.insert.mockResolvedValue({ id: 'code-1', status: 'valid' });
    walletModel.findBookingTransactionForUpdate.mockResolvedValue(null);
    walletModel.ensureWallet.mockResolvedValue({ user_id: 'driver-1', balance: '0' });
    walletModel.adjustBalance.mockResolvedValue({ user_id: 'driver-1', balance: '2.50' });
    walletModel.insertTransaction.mockResolvedValue({ id: 'driver-settlement-1', type: 'driver_payment' });
  });

  it('creates one ledger row and initializes the exact deposit in pesewas', async () => {
    const result = await service.initializeDeposit('passenger-1', 'booking-1', {
      idempotencyKey: 'passenger-request-1', callbackUrl: 'trotro://payment',
    });

    expect(paymentModel.insert).toHaveBeenCalledWith(expect.objectContaining({
      bookingId: 'booking-1', passengerId: 'passenger-1', type: 'deposit',
      amount: 2.5, provider: 'paystack', idempotencyKey: 'passenger-request-1',
    }), expect.anything());
    expect(paystackService.initializeTransaction).toHaveBeenCalledWith(expect.objectContaining({
      email: 'passenger@example.com', amountPesewas: 250,
      reference: 'DEP_booking_abc',
    }));
    expect(result).toMatchObject({ status: 'pending', amount: 2.5, currency: 'GHS' });
  });

  it('returns a stored checkout for a repeated initialization', async () => {
    paymentModel.findByIdempotencyKeyForUpdate.mockResolvedValue({
      ...payment, status: 'pending', authorization_url: 'https://checkout', access_code: 'access-1',
    });

    const result = await service.initializeDeposit('passenger-1', 'booking-1', {
      idempotencyKey: 'passenger-request-1',
    });

    expect(result.alreadyInitialized).toBe(true);
    expect(paystackService.initializeTransaction).not.toHaveBeenCalled();
  });

  it('atomically reserves a seat, confirms the booking and creates one boarding code', async () => {
    paymentModel.findByProviderReferenceForUpdate.mockResolvedValue({ ...payment, status: 'pending' });
    paymentModel.markSucceeded.mockResolvedValue({ ...payment, status: 'succeeded' });

    const result = await service.applyVerifiedDeposit('DEP_booking_abc', {
      success: true, amount: 2.5, currency: 'GHS', channel: 'mobile_money',
      paidAt: '2026-08-12T07:00:00Z', gatewayResponse: 'Approved',
    });

    expect(paymentModel.markSucceeded).toHaveBeenCalledTimes(1);
    expect(busModel.reserveSeatForPaidBooking).toHaveBeenCalledWith(
      'bus-1', 'driver-1', expect.anything(),
    );
    expect(bookingModel.confirmAfterDeposit).toHaveBeenCalledWith('booking-1', expect.anything());
    expect(codeModel.insert).toHaveBeenCalledTimes(1);
    expect(walletModel.adjustBalance).toHaveBeenCalledWith('driver-1', 2.5, expect.anything());
    expect(walletModel.insertTransaction).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'driver-1', bookingId: 'booking-1', type: 'driver_payment', amount: 2.5,
      reference: 'DRIVER_DEPOSIT_booking-1',
    }), expect.anything());
    expect(result).toMatchObject({ success: true, reserved: true, refundPending: false });
  });

  it('does not reserve or generate another code for a replayed success webhook', async () => {
    paymentModel.findByProviderReferenceForUpdate.mockResolvedValue({ ...payment, status: 'succeeded' });
    bookingModel.findByIdForUpdate.mockResolvedValue({
      ...booking, status: 'confirmed', payment_status: 'deposit_paid',
    });

    const result = await service.applyVerifiedDeposit('DEP_booking_abc', {
      success: true, amount: 2.5, currency: 'GHS',
    });

    expect(result).toMatchObject({ success: true, reserved: true, alreadyProcessed: true });
    expect(result.code).toMatchObject({ code: '123456' });
    expect(busModel.reserveSeatForPaidBooking).not.toHaveBeenCalled();
    expect(codeModel.insert).not.toHaveBeenCalled();
  });

  it('moves the paid booking to refund pending when capacity disappeared', async () => {
    paymentModel.findByProviderReferenceForUpdate.mockResolvedValue({ ...payment, status: 'pending' });
    paymentModel.markSucceeded.mockResolvedValue({ ...payment, status: 'succeeded' });
    busModel.reserveSeatForPaidBooking.mockResolvedValue(null);
    bookingModel.markDepositRefundPending.mockResolvedValue({
      ...booking, payment_status: 'refund_pending',
    });

    const result = await service.applyVerifiedDeposit('DEP_booking_abc', {
      success: true, amount: 2.5, currency: 'GHS',
    });

    expect(result).toMatchObject({ success: true, reserved: false, refundPending: true });
    expect(bookingModel.markDepositRefundPending).toHaveBeenCalledWith('booking-1', expect.anything());
    expect(bookingModel.confirmAfterDeposit).not.toHaveBeenCalled();
    expect(codeModel.insert).not.toHaveBeenCalled();
  });

  it('fails a mismatched amount without marking the booking paid', async () => {
    paymentModel.findByProviderReferenceForUpdate.mockResolvedValue({ ...payment, status: 'pending' });
    paymentModel.markFailed.mockResolvedValue({ ...payment, status: 'failed' });

    const result = await service.applyVerifiedDeposit('DEP_booking_abc', {
      success: true, amount: 1, currency: 'GHS',
    });

    expect(result.success).toBe(false);
    expect(paymentModel.markFailed).toHaveBeenCalledWith('payment-1', expect.objectContaining({
      code: 'PAYMENT_MISMATCH',
    }), expect.anything());
    expect(busModel.reserveSeatForPaidBooking).not.toHaveBeenCalled();
  });

  it('does not verify a reference unrelated to the authenticated passenger booking', async () => {
    bookingModel.findById.mockResolvedValue(booking);
    paymentModel.findForPassengerBookingReference.mockResolvedValue(null);

    await expect(service.verifyDeposit('passenger-1', 'booking-1', 'DEP_someone_else'))
      .rejects.toThrow('Deposit transaction not found');
    expect(paystackService.verifyTransaction).not.toHaveBeenCalled();
  });

  it('ignores unrelated charge webhooks without calling Paystack', async () => {
    await expect(service.handleWebhook({
      event: 'charge.success', data: { reference: 'TOPUP_1', metadata: { purpose: 'wallet_topup' } },
    })).resolves.toEqual({ ignored: true });
    expect(paystackService.verifyTransaction).not.toHaveBeenCalled();
  });

  it('initializes only the remaining balance after boarding', async () => {
    bookingModel.findProvisionalForPaymentForUpdate.mockResolvedValue({
      ...booking, status: 'confirmed', boarded_at: '2026-08-12T07:30:00Z',
      payment_status: 'balance_pending', remaining_balance: '7.50',
    });
    paymentModel.insert.mockResolvedValue({
      ...payment, type: 'balance', amount: '7.50', provider_reference: 'BAL_booking_abc',
    });
    paymentModel.markInitialized.mockResolvedValue({
      ...payment, type: 'balance', amount: '7.50', provider_reference: 'BAL_booking_abc',
      status: 'pending', authorization_url: 'https://checkout', access_code: 'balance-access',
    });

    const result = await service.initializeBalance('passenger-1', 'booking-1', {
      idempotencyKey: 'balance-request-1',
    });

    expect(paymentModel.insert).toHaveBeenCalledWith(expect.objectContaining({
      type: 'balance', amount: 7.5,
    }), expect.anything());
    expect(paystackService.initializeTransaction).toHaveBeenCalledWith(expect.objectContaining({
      amountPesewas: 750, reference: 'BAL_booking_abc',
    }));
    expect(result.amount).toBe(7.5);
  });

  it('marks the booking fully paid after a verified balance payment', async () => {
    paymentModel.findByProviderReferenceForUpdate.mockResolvedValue({
      ...payment, type: 'balance', amount: '7.50', status: 'pending',
    });
    bookingModel.findByIdForUpdate.mockResolvedValue({
      ...booking, status: 'confirmed', boarded_at: '2026-08-12T07:30:00Z',
      payment_status: 'balance_pending', remaining_balance: '7.50',
    });
    paymentModel.markSucceeded.mockResolvedValue({ ...payment, type: 'balance', status: 'succeeded' });
    bookingModel.markBalancePaid.mockResolvedValue({
      ...booking, status: 'confirmed', payment_status: 'fully_paid', remaining_balance: '0',
    });

    const result = await service.applyVerifiedBalance('BAL_booking_abc', {
      success: true, amount: 7.5, currency: 'GHS', channel: 'mobile_money',
    });

    expect(bookingModel.markBalancePaid).toHaveBeenCalledWith('booking-1', null, expect.anything());
    expect(result).toMatchObject({ success: true, booking: { payment_status: 'fully_paid' } });
  });
});
