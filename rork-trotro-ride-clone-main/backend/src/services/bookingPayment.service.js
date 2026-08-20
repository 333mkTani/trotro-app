const { v4: uuidv4 } = require('uuid');
const { withTransaction } = require('../config/db');
const bookingModel = require('../models/booking.model');
const paymentModel = require('../models/bookingPayment.model');
const profileModel = require('../models/profile.model');
const busModel = require('../models/bus.model');
const codeModel = require('../models/code.model');
const paystackService = require('./paystack.service');
const push = require('./push.service');
const { ApiError } = require('../utils/ApiError');
const { generateBoardingCode, buildQrPayload } = require('../utils/codes');
const { emitToDriver, emitToUser } = require('../realtime/io');
const refundService = require('./refund.service');
const { increment, recordEvent } = require('../observability/metrics');

const checkoutResponse = (payment, extra = {}) => ({
  paymentId: payment.id,
  bookingId: payment.booking_id,
  reference: payment.provider_reference,
  authorizationUrl: payment.authorization_url,
  accessCode: payment.access_code,
  amount: Number(payment.amount),
  currency: payment.currency,
  status: payment.status,
  ...extra,
});

const initializeDeposit = async (passengerId, bookingId, { idempotencyKey, callbackUrl }) => {
  const prepared = await withTransaction(async (client) => {
    const booking = await bookingModel.findProvisionalForPaymentForUpdate(bookingId, passengerId, client);
    if (!booking) throw ApiError.notFound('Provisional booking not found');
    if (booking.payment_status === 'deposit_paid') {
      const existing = await paymentModel.findActiveDepositForBookingForUpdate(bookingId, client);
      return { existing, completed: true };
    }
    if (booking.payment_status !== 'deposit_pending') {
      throw ApiError.badRequest(`Deposit cannot be initialized in status "${booking.payment_status}"`);
    }
    if (new Date(booking.hold_expires_at).getTime() <= Date.now()) {
      throw ApiError.conflict('The provisional seat hold has expired');
    }

    const byKey = await paymentModel.findByIdempotencyKeyForUpdate(idempotencyKey, client);
    if (byKey) {
      if (byKey.booking_id !== bookingId || byKey.passenger_id !== passengerId || byKey.type !== 'deposit') {
        throw ApiError.conflict('Idempotency key has already been used');
      }
      return { existing: byKey };
    }

    const active = await paymentModel.findActiveDepositForBookingForUpdate(bookingId, client);
    if (active) return { existing: active };

    const reference = `DEP_${bookingId.replace(/-/g, '').slice(0, 12)}_${uuidv4().slice(0, 8)}`;
    const payment = await paymentModel.insert({
      bookingId,
      passengerId,
      driverId: booking.driver_id,
      type: 'deposit',
      amount: Number(booking.deposit_amount),
      currency: 'GHS',
      provider: 'paystack',
      providerReference: reference,
      idempotencyKey,
      metadata: { purpose: 'booking_deposit', bookingId, passengerId },
    }, client);
    return { payment, booking };
  });

  if (prepared.existing?.authorization_url || prepared.completed) {
    if (!prepared.existing) throw ApiError.internal('Deposit payment record is missing');
    return checkoutResponse(prepared.existing, {
      alreadyInitialized: true,
      alreadyPaid: prepared.completed || prepared.existing?.status === 'succeeded',
    });
  }

  const payment = prepared.payment || prepared.existing;
  const profile = await profileModel.findById(passengerId);
  if (!profile) throw ApiError.notFound('Profile not found');
  const email = profile.email || `${(profile.phone || passengerId).replace(/[^0-9a-zA-Z]/g, '')}@booking.trotro.app`;

  try {
    const checkout = await paystackService.initializeTransaction({
      email,
      amountPesewas: Math.round(Number(payment.amount) * 100),
      reference: payment.provider_reference,
      metadata: { purpose: 'booking_deposit', bookingId, passengerId, paymentId: payment.id },
      callbackUrl,
    });
    const initialized = await paymentModel.markInitialized(payment.id, {
      authorizationUrl: checkout.authorization_url,
      accessCode: checkout.access_code,
    });
    return checkoutResponse(initialized);
  } catch (error) {
    await paymentModel.markFailed(payment.id, {
      code: 'INITIALIZATION_FAILED', message: error.message,
    });
    throw error;
  }
};

const notifyReservationResult = (result) => {
  const booking = result.booking;
  if (!booking || result.alreadyProcessed) return;

  emitToUser(booking.passenger_id, 'booking:updated', booking);
  if (booking.driver_id) emitToDriver(booking.driver_id, 'booking:updated', booking);

  setImmediate(async () => {
    try {
      if (result.refundPending && booking.payment_status === 'refund_pending') {
        await refundService.initiateForBooking(booking.id);
      }
      const passenger = await profileModel.findById(booking.passenger_id);
      if (passenger?.fcm_token) {
        await push.send(passenger.fcm_token, result.reserved ? {
          title: 'Seat reserved',
          body: `${booking.pickup_stop_name} to ${booking.destination_stop_name} is confirmed.`,
          data: { type: 'booking_confirmed', bookingId: booking.id },
        } : {
          title: 'Seat could not be reserved',
          body: 'Your deposit was received, but the bus became unavailable. A refund is pending.',
          data: { type: 'booking_refund_pending', bookingId: booking.id },
        });
      }
      if (result.reserved && booking.driver_id) {
        const driver = await profileModel.findById(booking.driver_id);
        if (driver?.fcm_token) {
          await push.send(driver.fcm_token, {
            title: 'Paid passenger booking',
            body: `${booking.pickup_stop_name} to ${booking.destination_stop_name}`,
            data: { type: 'new_booking', bookingId: booking.id },
          });
        }
      }
    } catch (error) {
      console.error('[booking-payment] reservation notification failed:', error.message);
    }
  });
};

const applyVerifiedDeposit = async (reference, verification) => {
  const result = await withTransaction(async (client) => {
    const payment = await paymentModel.findByProviderReferenceForUpdate('paystack', reference, client);
    if (!payment || payment.type !== 'deposit') return { ignored: true };
    if (payment.status === 'succeeded') {
      increment('trotro_payment_duplicate_callbacks_total', 1, { type: payment.type });
      recordEvent('payment.duplicate_callback', { type: payment.type });
      const booking = await bookingModel.findByIdForUpdate(payment.booking_id, client);
      const existingCode = booking?.status === 'confirmed'
        ? await codeModel.findByBookingId(payment.booking_id, client)
        : null;
      return {
        success: true,
        reserved: booking?.status === 'confirmed' && booking?.payment_status === 'deposit_paid',
        refundPending: booking?.payment_status === 'refund_pending',
        alreadyProcessed: true,
        payment,
        booking,
        code: existingCode,
      };
    }
    if (!['initiated', 'pending'].includes(payment.status)) return { ignored: true };

    const amountMatches = verification.currency === payment.currency
      && Math.abs(Number(verification.amount) - Number(payment.amount)) < 0.01;
    if (!verification.success || !amountMatches) {
      increment(amountMatches ? 'trotro_payment_not_successful_total' : 'trotro_payment_mismatches_total');
      recordEvent(amountMatches ? 'payment.not_successful' : 'payment.mismatch', { type: payment.type });
      const failed = await paymentModel.markFailed(payment.id, {
        code: amountMatches ? 'PAYMENT_NOT_SUCCESSFUL' : 'PAYMENT_MISMATCH',
        message: amountMatches ? 'Paystack did not confirm the payment' : 'Payment amount or currency did not match',
      }, client);
      return { success: false, payment: failed };
    }

    const booking = await bookingModel.findByIdForUpdate(payment.booking_id, client);
    if (!booking) throw ApiError.notFound('Booking not found for deposit');

    const succeeded = await paymentModel.markSucceeded(payment.id, {
      confirmedAt: verification.paidAt,
      channel: verification.channel,
      metadata: { gatewayResponse: verification.gatewayResponse },
    }, client);

    if (booking.status !== 'pending' || booking.payment_status !== 'deposit_pending') {
      const refundBooking = ['deposit_pending', 'failed'].includes(booking.payment_status)
        ? await bookingModel.markDepositRefundPending(booking.id, client)
        : booking;
      return {
        success: true, reserved: false, refundPending: true,
        payment: succeeded, booking: refundBooking,
      };
    }

    const bus = await busModel.reserveSeatForPaidBooking(booking.bus_id, booking.driver_id, client);
    if (!bus) {
      const refundBooking = await bookingModel.markDepositRefundPending(booking.id, client);
      return {
        success: true, reserved: false, refundPending: true,
        payment: succeeded, booking: refundBooking,
      };
    }

    const confirmed = await bookingModel.confirmAfterDeposit(booking.id, client);
    if (!confirmed) throw ApiError.conflict('Booking could not be confirmed after reserving the seat');

    const code = generateBoardingCode(6);
    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const qrPayload = buildQrPayload({ bookingId: booking.id, code, validUntil });
    const verificationCode = await codeModel.insert(
      { bookingId: booking.id, code, qrPayload, validUntil }, client,
    );

    return {
      success: true,
      reserved: true,
      refundPending: false,
      payment: succeeded,
      booking: confirmed,
      code: verificationCode,
      bus,
    };
  });

  notifyReservationResult(result);
  return result;
};

const verifyDeposit = async (passengerId, bookingId, reference) => {
  if (!reference) throw ApiError.badRequest('Reference is required');
  const booking = await bookingModel.findById(bookingId);
  if (!booking || booking.passenger_id !== passengerId) throw ApiError.notFound('Booking not found');
  const payment = await paymentModel.findForPassengerBookingReference(
    passengerId, bookingId, 'paystack', reference,
  );
  if (!payment || payment.type !== 'deposit') throw ApiError.notFound('Deposit transaction not found');
  const verification = await paystackService.verifyTransaction(reference);
  return applyVerifiedDeposit(reference, verification);
};

const initializeBalance = async (passengerId, bookingId, { idempotencyKey, callbackUrl }) => {
  const prepared = await withTransaction(async (client) => {
    const booking = await bookingModel.findProvisionalForPaymentForUpdate(bookingId, passengerId, client);
    if (!booking) throw ApiError.notFound('Booking not found');
    if (booking.payment_status === 'fully_paid') {
      const existing = await paymentModel.findActiveBalanceForBookingForUpdate(bookingId, client);
      if (!existing) throw ApiError.internal('Balance payment record is missing');
      return { existing, completed: true };
    }
    if (booking.status !== 'confirmed' || !booking.boarded_at || booking.payment_status !== 'balance_pending') {
      throw ApiError.badRequest('The remaining balance is payable only after boarding verification');
    }
    const amount = Number(booking.remaining_balance);
    if (!Number.isFinite(amount) || amount <= 0) throw ApiError.badRequest('No remaining balance is due');

    const byKey = await paymentModel.findByIdempotencyKeyForUpdate(idempotencyKey, client);
    if (byKey) {
      if (byKey.booking_id !== bookingId || byKey.passenger_id !== passengerId || byKey.type !== 'balance') {
        throw ApiError.conflict('Idempotency key has already been used');
      }
      return { existing: byKey };
    }
    const active = await paymentModel.findActiveBalanceForBookingForUpdate(bookingId, client);
    if (active) return { existing: active };

    const reference = `BAL_${bookingId.replace(/-/g, '').slice(0, 12)}_${uuidv4().slice(0, 8)}`;
    const payment = await paymentModel.insert({
      bookingId, passengerId, driverId: booking.driver_id, type: 'balance', amount,
      currency: 'GHS', provider: 'paystack', providerReference: reference, idempotencyKey,
      metadata: { purpose: 'booking_balance', bookingId, passengerId },
    }, client);
    return { payment };
  });

  if (prepared.existing?.authorization_url || prepared.completed) {
    return checkoutResponse(prepared.existing, {
      alreadyInitialized: true,
      alreadyPaid: prepared.completed || prepared.existing.status === 'succeeded',
    });
  }

  const payment = prepared.payment || prepared.existing;
  const profile = await profileModel.findById(passengerId);
  if (!profile) throw ApiError.notFound('Profile not found');
  const email = profile.email || `${(profile.phone || passengerId).replace(/[^0-9a-zA-Z]/g, '')}@booking.trotro.app`;
  try {
    const checkout = await paystackService.initializeTransaction({
      email, amountPesewas: Math.round(Number(payment.amount) * 100),
      reference: payment.provider_reference,
      metadata: { purpose: 'booking_balance', bookingId, passengerId, paymentId: payment.id },
      callbackUrl,
    });
    const initialized = await paymentModel.markInitialized(payment.id, {
      authorizationUrl: checkout.authorization_url, accessCode: checkout.access_code,
    });
    return checkoutResponse(initialized);
  } catch (error) {
    await paymentModel.markFailed(payment.id, { code: 'INITIALIZATION_FAILED', message: error.message });
    throw error;
  }
};

const applyVerifiedBalance = async (reference, verification) => {
  const result = await withTransaction(async (client) => {
    const payment = await paymentModel.findByProviderReferenceForUpdate('paystack', reference, client);
    if (!payment || payment.type !== 'balance') return { ignored: true };
    if (payment.status === 'succeeded') {
      increment('trotro_payment_duplicate_callbacks_total', 1, { type: payment.type });
      recordEvent('payment.duplicate_callback', { type: payment.type });
      const booking = await bookingModel.findByIdForUpdate(payment.booking_id, client);
      return { success: true, alreadyProcessed: true, payment, booking };
    }
    if (!['initiated', 'pending'].includes(payment.status)) return { ignored: true };
    const amountMatches = verification.currency === payment.currency
      && Math.abs(Number(verification.amount) - Number(payment.amount)) < 0.01;
    if (!verification.success || !amountMatches) {
      increment(amountMatches ? 'trotro_payment_not_successful_total' : 'trotro_payment_mismatches_total');
      recordEvent(amountMatches ? 'payment.not_successful' : 'payment.mismatch', { type: payment.type });
      const failed = await paymentModel.markFailed(payment.id, {
        code: amountMatches ? 'PAYMENT_NOT_SUCCESSFUL' : 'PAYMENT_MISMATCH',
        message: amountMatches ? 'Paystack did not confirm the payment' : 'Payment amount or currency did not match',
      }, client);
      return { success: false, payment: failed };
    }
    const booking = await bookingModel.findByIdForUpdate(payment.booking_id, client);
    if (!booking || booking.payment_status !== 'balance_pending' || !booking.boarded_at) {
      throw ApiError.conflict('Booking is not ready for balance payment');
    }
    const succeeded = await paymentModel.markSucceeded(payment.id, {
      confirmedAt: verification.paidAt, channel: verification.channel,
      metadata: { gatewayResponse: verification.gatewayResponse },
    }, client);
    const paid = await bookingModel.markBalancePaid(booking.id, null, client);
    if (!paid) throw ApiError.conflict('Booking balance could not be completed');
    return { success: true, payment: succeeded, booking: paid };
  });
  if (result.booking && !result.alreadyProcessed) {
    emitToUser(result.booking.passenger_id, 'booking:updated', result.booking);
    if (result.booking.driver_id) emitToDriver(result.booking.driver_id, 'booking:updated', result.booking);
  }
  return result;
};

const verifyBalance = async (passengerId, bookingId, reference) => {
  if (!reference) throw ApiError.badRequest('Reference is required');
  const payment = await paymentModel.findForPassengerBookingReference(
    passengerId, bookingId, 'paystack', reference,
  );
  if (!payment || payment.type !== 'balance') throw ApiError.notFound('Balance transaction not found');
  const verification = await paystackService.verifyTransaction(reference);
  return applyVerifiedBalance(reference, verification);
};

const handleWebhook = async (event) => {
  if (event?.event !== 'charge.success' || !event.data?.reference) return { ignored: true };
  const purpose = event.data.metadata?.purpose;
  const reference = String(event.data.reference);
  if (!['booking_deposit', 'booking_balance'].includes(purpose)
      && !reference.startsWith('DEP_') && !reference.startsWith('BAL_')) {
    return { ignored: true };
  }
  const verification = await paystackService.verifyTransaction(reference);
  return purpose === 'booking_balance' || reference.startsWith('BAL_')
    ? applyVerifiedBalance(reference, verification)
    : applyVerifiedDeposit(reference, verification);
};

module.exports = {
  initializeDeposit, verifyDeposit, applyVerifiedDeposit,
  initializeBalance, verifyBalance, applyVerifiedBalance, handleWebhook,
};
