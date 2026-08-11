const { withTransaction } = require('../config/db');
const bookingModel = require('../models/booking.model');
const codeModel = require('../models/code.model');
const busModel = require('../models/bus.model');
const ratingModel = require('../models/rating.model');
const driverModel = require('../models/driver.model');
const profileModel = require('../models/profile.model');
const routeModel = require('../models/route.model');
const scheduleLifecycleModel = require('../models/scheduleLifecycle.model');
const paymentModel = require('../models/bookingPayment.model');
const walletModel = require('../models/wallet.model');
const push = require('./push.service');
const refundService = require('./refund.service');
const { ApiError } = require('../utils/ApiError');
const { generateBoardingCode, buildQrPayload } = require('../utils/codes');
const { emitToDriver, emitToRoute, emitToUser } = require('../realtime/io');
const { calculateDeposit, calculateBookingDeadlines, getDepositPolicy } = require('../config/depositPolicy');

const listForUser = async (user, { status }) => {
  if (user.role === 'driver') {
    const bus = await busModel.findByDriverId(user.id);
    return bookingModel.listForDriver(user.id, { status, routeId: bus?.route_id ?? null });
  }
  return bookingModel.listForPassenger(user.id, { status });
};

const getById = async (id, user) => {
  const b = await bookingModel.findById(id);
  if (!b) throw ApiError.notFound('Booking not found');
  if (user.role !== 'admin' && b.passenger_id !== user.id && b.driver_id !== user.id) {
    throw ApiError.forbidden();
  }
  return b;
};

const create = async (passengerId, data) => {
  return withTransaction(async (client) => {
    const booking = await bookingModel.insert({ ...data, passengerId }, client);

    // A specific bus/driver may have been picked from a passenger-side search.
    // Treat that result as stale until availability is revalidated here.
    // Without a driver there's nothing to board yet — leave it 'pending'
    // until a driver claims it via POST /bookings/:id/confirm. Drivers
    // currently on the same route are notified live if they're connected.
    if (!data.driverId) {
      if (data.routeId) emitToRoute(data.routeId, 'booking:new', booking);
      return booking;
    }

    // Resolve the selected bus and enforce operational state on the server.
    const targetBusId = data.busId ?? (await busModel.findByDriverId(data.driverId))?.id ?? null;
    if (!targetBusId) throw ApiError.conflict('Driver has no assigned bus');
    const targetBus = await busModel.findById(targetBusId);
    if (!targetBus || targetBus.driver_id !== data.driverId || targetBus.status !== 'active') {
      throw ApiError.conflict('This driver is currently unavailable');
    }

    // Stationary drivers must decide manually. Keep the booking pending and do
    // not consume a seat until POST /bookings/:id/confirm succeeds.
    if (targetBus.driving_status !== 'EN_ROUTE') {
      emitToDriver(data.driverId, 'booking:new', booking);
      return booking;
    }

    // En-route drivers opt into automatic acceptance. The atomic UPDATE also
    // rechecks status/mode to close the race with availability toggles.
    const bus = await busModel.reserveSeatForAutoAccept(targetBusId, client);
    if (!bus) throw ApiError.conflict('This bus is unavailable or has no seats');

    const confirmed = await bookingModel.updateStatus(
      booking.id,
      'confirmed',
      { driverId: data.driverId, busId: targetBusId },
      client,
    );

    const code = generateBoardingCode(6);
    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const qrPayload = buildQrPayload({ bookingId: booking.id, code, validUntil });
    const verification = await codeModel.insert(
      { bookingId: booking.id, code, qrPayload, validUntil },
      client,
    );

    // Notify the driver about the new booking: instantly over the socket if
    // they have the app open, and via push in case they don't.
    emitToDriver(data.driverId, 'booking:new', confirmed);

    setImmediate(async () => {
      try {
        const driverProfile = await profileModel.findById(data.driverId);
        if (driverProfile?.fcm_token) {
          await push.send(driverProfile.fcm_token, {
            title: '🎫 New Passenger Booking',
            body: `${confirmed.pickup_stop_name} → ${confirmed.destination_stop_name}`,
            data: { type: 'new_booking', bookingId: booking.id },
          });
        }
      } catch (e) {
        console.error('[booking] driver notify failed:', e.message);
      }
    });

    return {
      ...confirmed,
      verification_code: verification.code,
      code_valid_until: verification.valid_until,
    };
  });
};

const createProvisional = async (passengerId, data) => withTransaction(async (client) => {
  if (data.pickupStopId === data.destinationStopId) {
    throw ApiError.badRequest('Pickup and destination stops must be different');
  }

  const route = await routeModel.findById(data.routeId);
  if (!route || route.status !== 'active') throw ApiError.notFound('Active route not found');

  const stops = await routeModel.findStops(data.routeId);
  const stopIds = new Set(stops.map((stop) => stop.id));
  if (!stopIds.has(data.pickupStopId) || !stopIds.has(data.destinationStopId)) {
    throw ApiError.badRequest('Pickup and destination stops must belong to the selected route');
  }

  const bus = await bookingModel.lockBusForProvisionalHold(data.busId, client);
  if (
    !bus || bus.status !== 'active' || bus.driver_id !== data.driverId ||
    bus.route_id !== data.routeId
  ) {
    throw ApiError.conflict('The selected bus is no longer available for this route');
  }

  const existingHold = await bookingModel.findActiveProvisionalHold(passengerId, data.busId, client);
  if (existingHold) {
    return {
      booking: existingHold,
      payment: {
        currency: 'GHS',
        totalFare: Number(existingHold.total_fare),
        depositAmount: Number(existingHold.deposit_amount),
        remainingBalance: Number(existingHold.remaining_balance),
        status: existingHold.payment_status,
        holdExpiresAt: existingHold.hold_expires_at,
      },
      reused: true,
    };
  }

  const activeHolds = await bookingModel.countActiveProvisionalHolds(data.busId, client);
  if (activeHolds >= Number(bus.seats_available)) {
    throw ApiError.conflict('This bus has no seats available');
  }

  let payment;
  try {
    payment = calculateDeposit(route.fare);
  } catch (_) {
    throw ApiError.badRequest('Route fare is not configured');
  }

  const policy = getDepositPolicy();
  const holdExpiresAt = new Date(Date.now() + policy.holdMinutes * 60 * 1000).toISOString();
  let deadlines;
  try {
    deadlines = calculateBookingDeadlines(data.desiredArrivalTime, data.bufferMinutes, policy);
  } catch (_) {
    throw ApiError.badRequest('A valid pickup time is required');
  }
  const booking = await bookingModel.insertProvisional({
    ...data,
    passengerId,
    routeName: route.name,
    ...payment,
    holdExpiresAt,
    ...deadlines,
  }, client);

  return {
    booking,
    payment: {
      currency: 'GHS',
      totalFare: payment.totalFare,
      depositAmount: payment.depositAmount,
      remainingBalance: payment.remainingBalance,
      status: 'deposit_pending',
      holdExpiresAt,
    },
  };
});

/**
 * Confirms a booking and atomically issues a verification + QR code,
 * decrementing the bus's available seats.
 */
const confirm = async (bookingId, { driverId, busId } = {}) => {
  return withTransaction(async (client) => {
    const existing = await bookingModel.findById(bookingId, client);
    if (!existing) throw ApiError.notFound('Booking not found');
    if (existing.status === 'confirmed') {
      const code = await codeModel.findByBookingId(bookingId);
      return { booking: existing, code };
    }
    if (!['pending'].includes(existing.status)) {
      throw ApiError.badRequest(`Cannot confirm booking in status "${existing.status}"`);
    }

    const effectiveDriverId = driverId ?? existing.driver_id;
    if (!effectiveDriverId) throw ApiError.badRequest('A driver is required to confirm this booking');
    if (existing.driver_id && existing.driver_id !== effectiveDriverId) {
      throw ApiError.forbidden('This booking is assigned to another driver');
    }

    const driverBus = await busModel.findByDriverId(effectiveDriverId);
    const targetBusId = busId ?? existing.bus_id ?? driverBus?.id ?? null;
    const targetBus = targetBusId ? await busModel.findById(targetBusId) : null;
    if (!targetBus || targetBus.driver_id !== effectiveDriverId || targetBus.status !== 'active') {
      throw ApiError.conflict('Driver is currently unavailable');
    }

    const booking = await bookingModel.updateStatus(
      bookingId,
      'confirmed',
      { driverId: effectiveDriverId, busId: targetBusId },
      client,
    );

    const bus = await busModel.reserveSeat(targetBusId, client);
    if (!bus) throw ApiError.conflict('No seats available on this bus');

    const code = generateBoardingCode(6);
    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const qrPayload = buildQrPayload({ bookingId, code, validUntil });
    const verification = await codeModel.insert(
      { bookingId, code, qrPayload, validUntil },
      client,
    );

    if (booking.driver_id) emitToDriver(booking.driver_id, 'booking:updated', booking);

    return { booking, code: verification };
  });
};

const cancel = async (bookingId, user) => {
  const result = await withTransaction(async (client) => {
    const existing = await bookingModel.findByIdForUpdate(bookingId, client);
    if (!existing) throw ApiError.notFound('Booking not found');
    if (user.role !== 'admin' && existing.passenger_id !== user.id && existing.driver_id !== user.id) {
      throw ApiError.forbidden();
    }
    if (existing.boarded_at) throw ApiError.badRequest('A ride cannot be cancelled after boarding');
    if (!['pending', 'confirmed'].includes(existing.status)) {
      throw ApiError.badRequest(`Cannot cancel a ${existing.status} booking`);
    }
    const booking = await bookingModel.cancelForUser(bookingId, new Date(), client);
    if (!booking) throw ApiError.conflict('Booking was already closed');
    const code = await codeModel.findByBookingId(bookingId, client);
    if (code?.status === 'valid') await codeModel.invalidate(code.id, client);
    if (booking.previous_status === 'confirmed' && booking.bus_id) {
      await busModel.adjustSeats(booking.bus_id, 1, client);
    }
    return booking;
  });
  if (result.driver_id) emitToDriver(result.driver_id, 'booking:updated', result);
  emitToUser(result.passenger_id, 'booking:updated', result);
  setImmediate(async () => {
    try {
      if (result.payment_status === 'refund_pending') {
        await refundService.initiateForBooking(result.id);
      }
      const recipientId = user.role === 'driver' ? result.passenger_id : result.driver_id;
      if (!recipientId) return;
      const recipient = await profileModel.findById(recipientId);
      if (recipient?.fcm_token) {
        await push.send(recipient.fcm_token, {
          title: 'Ride cancelled',
          body: result.payment_status === 'refund_pending'
            ? 'The seat was released and the deposit refund is pending.'
            : 'The booking was cancelled and the seat was released.',
          data: { type: 'booking_cancelled', bookingId: result.id },
        });
      }
    } catch (error) {
      console.error('[booking] cancellation notification failed:', error.message);
    }
  });
  return result;
};

const complete = async (bookingId, user) => {
  const existing = await bookingModel.findById(bookingId);
  if (!existing) throw ApiError.notFound('Booking not found');
  if (
    user &&
    user.role !== 'admin' &&
    existing.passenger_id !== user.id &&
    existing.driver_id !== user.id
  ) {
    throw ApiError.forbidden();
  }
  if (existing.status !== 'confirmed') {
  if (existing.status === 'completed') return existing;
    throw ApiError.badRequest(`Cannot complete a ${existing.status} booking`);
  }
  if (!existing.arrived_at) throw ApiError.badRequest('Arrival has not been detected');
  if (!existing.paid_at) throw ApiError.badRequest('Ride must be paid before completion');
  const redeemedCode = await codeModel.findByBookingId(bookingId);
  if (!redeemedCode || redeemedCode.status !== 'used') {
    throw ApiError.badRequest('Boarding code must be redeemed before completing the ride');
  }
  return withTransaction(async (client) => {
    const booking = await bookingModel.updateStatus(bookingId, 'completed', {}, client);
    if (existing.source_occurrence_id) {
      await scheduleLifecycleModel.markCompleted(existing.source_occurrence_id, client);
    }
    if (!booking) throw ApiError.notFound('Booking not found');
    // The passenger has alighted, so free the seat they held. A booking only
    // ever releases its seat once: 'confirmed' is the sole state that holds a
    // reservation, and 'completed'/'cancelled' are terminal and mutually
    // exclusive — so this can't double-restore with cancel().
    if (existing.status === 'confirmed' && existing.bus_id) {
      await busModel.adjustSeats(existing.bus_id, 1, client);
    }
    if (booking.driver_id) emitToDriver(booking.driver_id, 'booking:updated', booking);
    return booking;
  });
};

const redeemCode = async (code, driverUser) => {
  const result = await withTransaction(async (client) => {
    const record = await codeModel.findByCode(code, client);
    if (!record) throw ApiError.notFound('Code not found');
    if (record.status !== 'valid') throw ApiError.badRequest(`Code is ${record.status}`);
    if (new Date(record.valid_until).getTime() < Date.now()) throw ApiError.badRequest('Code expired');
    const booking = await bookingModel.findByIdForUpdate(record.booking_id, client);
    if (!booking) throw ApiError.notFound('Booking not found');
    if (driverUser && driverUser.role === 'driver' && booking.driver_id && booking.driver_id !== driverUser.id) {
      throw ApiError.forbidden('Code is not for this driver');
    }
    const used = await codeModel.markUsed(record.id, client);
    if (!used) throw ApiError.badRequest('Code is already used');
    const boarded = await bookingModel.markBoardedAndOpenBalance(booking.id, client);
    return { booking: boarded, code: used };
  });

  emitToUser(result.booking.passenger_id, 'booking:updated', result.booking);
  if (result.booking.driver_id) emitToDriver(result.booking.driver_id, 'booking:updated', result.booking);
  setImmediate(async () => {
    try {
      const passenger = await profileModel.findById(result.booking.passenger_id);
      if (passenger?.fcm_token && result.booking.payment_status === 'balance_pending') {
        await push.send(passenger.fcm_token, {
          title: 'Boarding verified',
          body: `Pay the remaining GH₵${Number(result.booking.remaining_balance).toFixed(2)} to complete your fare.`,
          data: { type: 'booking_balance_due', bookingId: result.booking.id },
        });
      }
    } catch (error) {
      console.error('[booking] boarding payment notification failed:', error.message);
    }
  });
  return result;
};

const recordCashPayment = async (bookingId, passengerId) => withTransaction(async (client) => {
  const booking = await bookingModel.findForPaymentForUpdate(bookingId, passengerId, client);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status !== 'confirmed') throw ApiError.badRequest('Only confirmed rides can be paid');
  if (!booking.boarded_at || booking.code_status !== 'used') {
    throw ApiError.badRequest('Boarding code must be redeemed before payment');
  }
  if (booking.payment_status === 'balance_pending') {
    throw ApiError.badRequest('Use the secure balance checkout for this deposit-backed ride');
  }
  if (booking.paid_at) return booking;
  return bookingModel.markPaid(bookingId, 'cash', client);
});

const rateDriver = async (bookingId, passengerId, { rating, comment }) => {
  return withTransaction(async (client) => {
    const booking = await bookingModel.findById(bookingId, client);
    if (!booking) throw ApiError.notFound('Booking not found');
    if (booking.passenger_id !== passengerId) throw ApiError.forbidden();
    if (booking.status !== 'completed') throw ApiError.badRequest('Booking not completed');
    if (!booking.driver_id) throw ApiError.badRequest('No driver assigned to booking');
    const existing = await ratingModel.findByBookingId(bookingId);
    if (existing) throw ApiError.conflict('Already rated');
    const inserted = await ratingModel.insert(
      { bookingId, passengerId, driverId: booking.driver_id, rating, comment },
      client,
    );
    await driverModel.recomputeRating(booking.driver_id, client);
    return inserted;
  });
};

// Releases seats held by abandoned confirmed bookings. This never completes a
// ride and never charges a wallet.
const expireStale = async (olderThanHours = 4) => {
  const expired = await withTransaction(async (client) => {
    const due = await bookingModel.expireDue(new Date(), olderThanHours, client);
    for (let index = 0; index < due.length; index += 1) {
      const booking = due[index];
      if (booking.previous_status === 'confirmed' && booking.bus_id) {
        await busModel.adjustSeats(booking.bus_id, 1, client);
      }
      const code = await codeModel.findByBookingId(booking.id, client);
      if (code?.status === 'valid') await codeModel.invalidate(code.id, client);

      const compensationPercent = getDepositPolicy().noShowCompensationPercent;
      const deposit = Number(booking.deposit_amount);
      const eligible = booking.previous_status === 'confirmed'
        && booking.payment_status === 'deposit_paid'
        && booking.driver_id
        && booking.driver_pickup_arrived_at
        && Number.isFinite(deposit) && deposit > 0
        && compensationPercent > 0;
      if (eligible) {
        const amount = Math.round(deposit * compensationPercent) / 100;
        await paymentModel.insert({
          bookingId: booking.id,
          passengerId: booking.passenger_id,
          driverId: booking.driver_id,
          type: 'no_show_compensation',
          amount,
          currency: 'GHS',
          status: 'succeeded',
          provider: 'internal',
          providerReference: `NOSHOW_${booking.id}`,
          idempotencyKey: `no-show-compensation:${booking.id}`,
          metadata: {
            reason: 'passenger_no_show',
            pickupArrivedAt: booking.driver_pickup_arrived_at,
            boardingDeadline: booking.boarding_deadline,
          },
        }, client);
        await walletModel.ensureWallet(booking.driver_id, client);
        await walletModel.adjustBalance(booking.driver_id, amount, client);
        await walletModel.insertTransaction({
          userId: booking.driver_id,
          bookingId: booking.id,
          type: 'no_show_compensation',
          amount,
          description: `No-show compensation for ${booking.pickup_stop_name} pickup`,
          reference: `NOSHOW_${booking.id}_CREDIT`,
        }, client);
        const compensated = await bookingModel.markNoShowCompensated(booking.id, amount, client);
        if (!compensated) throw ApiError.conflict('No-show compensation eligibility changed');
        due[index] = { ...compensated, previous_status: booking.previous_status };
      }
    }
    return due;
  });
  for (const booking of expired) {
    if (booking.driver_id) emitToDriver(booking.driver_id, 'booking:updated', booking);
    emitToUser(booking.passenger_id, 'booking:updated', booking);
    if (booking.no_show_compensated_at && booking.driver_id) {
      setImmediate(async () => {
        try {
          const driver = await profileModel.findById(booking.driver_id);
          if (driver?.fcm_token) {
            await push.send(driver.fcm_token, {
              title: 'No-show compensation credited',
              body: `GH₵${Number(booking.no_show_compensation_amount).toFixed(2)} was added to your wallet.`,
              data: { type: 'no_show_compensation', bookingId: booking.id },
            });
          }
        } catch (error) {
          console.error('[booking] no-show compensation notification failed:', error.message);
        }
      });
    }
  }
  return expired;
};

module.exports = {
  listForUser, getById, create, createProvisional, confirm, cancel, complete, redeemCode,
  rateDriver, expireStale, recordCashPayment,
};
