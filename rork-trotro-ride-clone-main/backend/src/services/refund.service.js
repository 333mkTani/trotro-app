const crypto = require('crypto');
const { withTransaction } = require('../config/db');
const bookingModel = require('../models/booking.model');
const paymentModel = require('../models/bookingPayment.model');
const reconciliationModel = require('../models/paymentReconciliation.model');
const paystack = require('./paystack.service');
const { ApiError } = require('../utils/ApiError');
const { emitToUser } = require('../realtime/io');
const profileModel = require('../models/profile.model');
const push = require('./push.service');

const eventKey = (event) => {
  const data = event?.data || {};
  return String(data.id || data.refund_id || crypto.createHash('sha256')
    .update(JSON.stringify(event || {})).digest('hex')) + `:${event?.event || 'unknown'}`;
};

const safePayload = (event) => ({
  event: event?.event,
  id: event?.data?.id,
  status: event?.data?.status,
  amount: event?.data?.amount,
  transactionReference: event?.data?.transaction?.reference || event?.data?.transaction_reference,
  failureReason: event?.data?.failure_reason,
});

const applyOutcome = async ({ refundId, originalReference, status, amount, event }) => {
  const result = await withTransaction(async (client) => {
    let refund = originalReference
      ? await paymentModel.findRefundByOriginalReferenceForUpdate(originalReference, client)
      : null;
    if (!refund && refundId) {
      const all = await paymentModel.findByIdForUpdate(refundId, client);
      refund = all?.type === 'refund' ? all : null;
    }
    if (!refund) return { ignored: true };
    if (refund.status === 'succeeded') return { success: true, alreadyProcessed: true, refund };

    const normalized = String(status || '').toLowerCase();
    if (['failed', 'cancelled'].includes(normalized)) {
      const failed = await paymentModel.markFailed(refund.id, {
        code: 'REFUND_FAILED', message: event?.data?.failure_reason || 'Paystack refund failed',
      }, client);
      await reconciliationModel.record({
        provider: 'paystack', eventKey: eventKey(event), eventType: event?.event || 'refund.failed',
        bookingId: refund.booking_id, paymentId: refund.id,
        providerReference: originalReference, payload: safePayload(event), outcome: 'failed',
        errorMessage: event?.data?.failure_reason,
      }, client);
      return { success: false, refund: failed };
    }
    if (!['processed', 'success', 'succeeded'].includes(normalized)) {
      return { success: false, pending: true, refund };
    }
    const refundedAmount = Number(amount || refund.amount);
    if (!Number.isFinite(refundedAmount) || refundedAmount <= 0
      || refundedAmount - Number(refund.amount) > 0.01) {
      throw ApiError.conflict('Refund amount did not match the ledger');
    }
    const succeeded = await paymentModel.markSucceeded(refund.id, {
      confirmedAt: new Date().toISOString(), metadata: { refundEvent: event?.event || 'reconciled' },
    }, client);
    const booking = await bookingModel.markRefunded(refund.booking_id, refundedAmount, client);
    if (!booking) throw ApiError.conflict('Booking is not awaiting this refund');
    await reconciliationModel.record({
      provider: 'paystack', eventKey: eventKey(event), eventType: event?.event || 'refund.reconciled',
      bookingId: booking.id, paymentId: refund.id,
      providerReference: originalReference, payload: safePayload(event), outcome: 'processed',
    }, client);
    return { success: true, refund: succeeded, booking };
  });
  if (result.booking) {
    emitToUser(result.booking.passenger_id, 'booking:updated', result.booking);
    setImmediate(async () => {
      try {
        const passenger = await profileModel.findById(result.booking.passenger_id);
        if (passenger?.fcm_token) await push.send(passenger.fcm_token, {
          title: 'Refund completed',
          body: `Your GH₵${Number(result.refund.amount).toFixed(2)} deposit refund was processed.`,
          data: { type: 'booking_refunded', bookingId: result.booking.id },
        });
      } catch (error) {
        console.error('[refund] passenger notification failed:', error.message);
      }
    });
  }
  return result;
};

const initiateForBooking = async (bookingId) => {
  const prepared = await withTransaction(async (client) => {
    const booking = await bookingModel.findByIdForUpdate(bookingId, client);
    if (!booking) throw ApiError.notFound('Booking not found');
    if (booking.payment_status === 'refunded') return { completed: true, booking };
    if (booking.payment_status !== 'refund_pending') {
      throw ApiError.badRequest('Booking is not eligible for a refund');
    }
    const deposit = await paymentModel.findSucceededDepositForBookingForUpdate(bookingId, client);
    if (!deposit) throw ApiError.conflict('Successful deposit payment not found');
    const existing = await paymentModel.findActiveRefundForParentForUpdate(deposit.id, client);
    if (existing) return { existing, deposit, booking };
    const refund = await paymentModel.insert({
      bookingId, passengerId: booking.passenger_id, driverId: booking.driver_id,
      type: 'refund', amount: Number(deposit.amount), currency: deposit.currency,
      status: 'initiated', provider: 'paystack', providerReference: null,
      idempotencyKey: `refund:${deposit.id}`, parentPaymentId: deposit.id,
      metadata: { reason: 'eligible_booking_cancellation', originalReference: deposit.provider_reference },
    }, client);
    return { refund, deposit, booking };
  });
  if (prepared.completed) return { success: true, alreadyProcessed: true, booking: prepared.booking };
  const refund = prepared.refund || prepared.existing;
  if (refund.status === 'succeeded') return { success: true, alreadyProcessed: true, refund };
  if (refund.status === 'pending' && refund.provider_event_id) return { success: true, pending: true, refund };

  if (refund.status === 'pending' && !refund.provider_event_id) {
    const matches = await paystack.listRefundsForTransaction(prepared.deposit.provider_reference);
    const provider = matches.find((item) => Math.abs(item.amount - Number(refund.amount)) < 0.01);
    if (!provider) {
      return { success: false, pending: true, needsReconciliation: true, refund };
    }
    const attached = await paymentModel.attachRefundProvider(refund.id, provider.id, {
      providerStatus: provider.status, recoveredByReconciliation: true,
    });
    if (['processed', 'success', 'succeeded'].includes(String(provider.status).toLowerCase())) {
      return applyOutcome({ refundId: attached.id,
        originalReference: prepared.deposit.provider_reference, status: provider.status,
        amount: provider.amount, event: { event: 'refund.reconciled', data: provider } });
    }
    return { success: true, pending: true, refund: attached };
  }

  const pendingBeforeProvider = await paymentModel.markRefundPending(refund.id, null, {
    originalReference: prepared.deposit.provider_reference,
  });
  const provider = await paystack.createRefund({
    transactionReference: prepared.deposit.provider_reference,
    amountPesewas: Math.round(Number(refund.amount) * 100),
    merchantNote: `Trotro booking ${bookingId} cancellation refund`,
  });
  const pending = await paymentModel.attachRefundProvider(pendingBeforeProvider.id, provider.id, {
    providerStatus: provider.status, originalReference: prepared.deposit.provider_reference,
  });
  if (['processed', 'success', 'succeeded'].includes(String(provider.status).toLowerCase())) {
    return applyOutcome({ refundId: pending.id, originalReference: prepared.deposit.provider_reference,
      status: provider.status, amount: provider.amount,
      event: { event: 'refund.reconciled', data: provider } });
  }
  return { success: true, pending: true, refund: pending };
};

const handleWebhook = async (event) => {
  if (!['refund.processed', 'refund.failed'].includes(event?.event)) return { ignored: true };
  const data = event.data || {};
  const originalReference = data.transaction?.reference || data.transaction_reference;
  return applyOutcome({
    originalReference, status: event.event === 'refund.processed' ? 'processed' : 'failed',
    amount: Number(data.amount) / 100, event,
  });
};

const reconcileBooking = async (bookingId) => {
  const payments = await paymentModel.listForBooking(bookingId);
  const refund = [...payments].reverse().find((item) => item.type === 'refund');
  if (!refund) return initiateForBooking(bookingId);
  if (refund.status === 'succeeded') return { success: true, alreadyProcessed: true, refund };
  if (!refund.provider_event_id) return initiateForBooking(bookingId);
  const provider = await paystack.getRefund(refund.provider_event_id);
  return applyOutcome({ refundId: refund.id, originalReference: provider.transactionReference,
    status: provider.status, amount: provider.amount,
    event: { event: 'refund.reconciled', data: provider } });
};

const reconcilePending = async (limit = 50) => {
  const [pending, bookings] = await Promise.all([
    paymentModel.listPendingRefunds(limit), bookingModel.listRefundPending(limit),
  ]);
  const results = [];
  const handledBookings = new Set();
  for (const refund of pending) {
    handledBookings.add(refund.booking_id);
    try {
      const provider = await paystack.getRefund(refund.provider_event_id);
      results.push(await applyOutcome({
        refundId: refund.id,
        originalReference: provider.transactionReference || refund.original_provider_reference,
        status: provider.status, amount: provider.amount,
        event: { event: 'refund.reconciled', data: provider },
      }));
    } catch (error) {
      results.push({ success: false, refundId: refund.id, error: error.message });
    }
  }
  for (const booking of bookings) {
    if (handledBookings.has(booking.id)) continue;
    try {
      results.push(await reconcileBooking(booking.id));
    } catch (error) {
      results.push({ success: false, bookingId: booking.id, error: error.message });
    }
  }
  return results;
};

module.exports = {
  initiateForBooking, handleWebhook, reconcileBooking, reconcilePending, applyOutcome,
};
