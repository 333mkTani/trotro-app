jest.mock('../../models/booking.model');
jest.mock('../../models/bookingPayment.model');
jest.mock('../../models/paymentReconciliation.model');
jest.mock('../../models/profile.model');
jest.mock('../push.service', () => ({ send: jest.fn() }));
jest.mock('../paystack.service');
jest.mock('../../realtime/io', () => ({ emitToUser: jest.fn() }));
jest.mock('../../config/db', () => ({ withTransaction: jest.fn((fn) => fn({ tx: true })) }));

const bookingModel = require('../../models/booking.model');
const paymentModel = require('../../models/bookingPayment.model');
const reconciliationModel = require('../../models/paymentReconciliation.model');
const paystack = require('../paystack.service');
const service = require('../refund.service');

describe('refund initiation and reconciliation', () => {
  const booking = { id: 'booking-1', passenger_id: 'passenger-1', driver_id: 'driver-1',
    payment_status: 'refund_pending', deposit_amount: '2.50' };
  const deposit = { id: 'deposit-1', booking_id: 'booking-1', passenger_id: 'passenger-1',
    amount: '2.50', currency: 'GHS', provider_reference: 'DEP_1', status: 'succeeded' };
  const refund = { id: 'refund-1', booking_id: 'booking-1', passenger_id: 'passenger-1',
    parent_payment_id: 'deposit-1', amount: '2.50', currency: 'GHS', status: 'initiated' };

  beforeEach(() => {
    jest.clearAllMocks();
    bookingModel.findByIdForUpdate.mockResolvedValue(booking);
    paymentModel.findSucceededDepositForBookingForUpdate.mockResolvedValue(deposit);
    paymentModel.findActiveRefundForParentForUpdate.mockResolvedValue(null);
    paymentModel.insert.mockResolvedValue(refund);
    paymentModel.markRefundPending.mockResolvedValue({ ...refund, status: 'pending' });
    paymentModel.attachRefundProvider.mockResolvedValue({
      ...refund, status: 'pending', provider_event_id: '9001',
    });
    paystack.createRefund.mockResolvedValue({ id: '9001', status: 'pending', amount: 2.5 });
  });

  it('persists a pending ledger before requesting the external refund', async () => {
    const result = await service.initiateForBooking('booking-1');
    expect(paymentModel.markRefundPending).toHaveBeenCalledWith(
      'refund-1', null, expect.any(Object),
    );
    expect(paystack.createRefund).toHaveBeenCalledWith(expect.objectContaining({
      transactionReference: 'DEP_1', amountPesewas: 250,
    }));
    expect(paymentModel.attachRefundProvider).toHaveBeenCalledWith(
      'refund-1', '9001', expect.any(Object),
    );
    expect(result).toMatchObject({ success: true, pending: true });
  });

  it('does not create another refund when an unlinked pending attempt exists', async () => {
    paymentModel.findActiveRefundForParentForUpdate.mockResolvedValue({ ...refund, status: 'pending' });
    paystack.listRefundsForTransaction.mockResolvedValue([]);
    const result = await service.initiateForBooking('booking-1');
    expect(paystack.createRefund).not.toHaveBeenCalled();
    expect(result).toMatchObject({ pending: true, needsReconciliation: true });
  });

  it('marks both ledger and booking refunded from a processed webhook', async () => {
    paymentModel.findRefundByOriginalReferenceForUpdate.mockResolvedValue({
      ...refund, status: 'pending', provider_event_id: '9001',
    });
    paymentModel.markSucceeded.mockResolvedValue({ ...refund, status: 'succeeded' });
    bookingModel.markRefunded.mockResolvedValue({ ...booking, payment_status: 'refunded' });
    reconciliationModel.record.mockResolvedValue({ id: 'event-1' });

    const result = await service.handleWebhook({
      event: 'refund.processed', data: { id: 9001, amount: 250, transaction: { reference: 'DEP_1' } },
    });
    expect(bookingModel.markRefunded).toHaveBeenCalledWith('booking-1', 2.5, expect.anything());
    expect(reconciliationModel.record).toHaveBeenCalledWith(expect.objectContaining({
      outcome: 'processed', bookingId: 'booking-1',
    }), expect.anything());
    expect(result).toMatchObject({ success: true, booking: { payment_status: 'refunded' } });
  });

  it('retries refund-pending bookings that have no linked provider refund yet', async () => {
    paymentModel.listPendingRefunds.mockResolvedValue([]);
    bookingModel.listRefundPending.mockResolvedValue([booking]);
    paymentModel.listForBooking.mockResolvedValue([]);
    const results = await service.reconcilePending(50);
    expect(paystack.createRefund).toHaveBeenCalledTimes(1);
    expect(results).toEqual([expect.objectContaining({ pending: true })]);
  });
});
