const { withTransaction } = require('../config/db');
const bookingModel = require('../models/booking.model');
const codeModel = require('../models/code.model');
const busModel = require('../models/bus.model');
const ratingModel = require('../models/rating.model');
const driverModel = require('../models/driver.model');
const profileModel = require('../models/profile.model');
const scheduleLifecycleModel = require('../models/scheduleLifecycle.model');
const push = require('./push.service');
const { ApiError } = require('../utils/ApiError');
const { generateBoardingCode, buildQrPayload } = require('../utils/codes');
const { emitToDriver, emitToRoute, emitToUser } = require('../realtime/io');

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
  const existing = await bookingModel.findById(bookingId);
  if (!existing) throw ApiError.notFound('Booking not found');
  if (
    user.role !== 'admin' &&
    existing.passenger_id !== user.id &&
    existing.driver_id !== user.id
  ) {
    throw ApiError.forbidden();
  }
  if (['completed', 'cancelled'].includes(existing.status)) {
    throw ApiError.badRequest(`Cannot cancel a ${existing.status} booking`);
  }
  if (existing.source_occurrence_id && existing.boarded_at) {
    throw ApiError.badRequest('A scheduled ride cannot be cancelled after boarding');
  }
  return withTransaction(async (client) => {
    const booking = await bookingModel.updateStatus(bookingId, 'cancelled', {}, client);
    const code = await codeModel.findByBookingId(bookingId);
    if (code && code.status === 'valid') await codeModel.invalidate(code.id);
    if (existing.status === 'confirmed' && existing.bus_id) {
      await busModel.adjustSeats(existing.bus_id, 1, client);
    }
    if (booking.driver_id) emitToDriver(booking.driver_id, 'booking:updated', booking);
    return booking;
  });
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
  const record = await codeModel.findByCode(code);
  if (!record) throw ApiError.notFound('Code not found');
  if (record.status !== 'valid') throw ApiError.badRequest(`Code is ${record.status}`);
  if (new Date(record.valid_until).getTime() < Date.now()) {
    throw ApiError.badRequest('Code expired');
  }
  const booking = await bookingModel.findById(record.booking_id);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (driverUser && driverUser.role === 'driver' && booking.driver_id && booking.driver_id !== driverUser.id) {
    throw ApiError.forbidden('Code is not for this driver');
  }
  const used = await codeModel.markUsed(record.id);
  const boarded = await bookingModel.markBoarded(booking.id);
  return { booking: boarded, code: used };
};

const recordCashPayment = async (bookingId, passengerId) => withTransaction(async (client) => {
  const booking = await bookingModel.findForPaymentForUpdate(bookingId, passengerId, client);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (booking.status !== 'confirmed') throw ApiError.badRequest('Only confirmed rides can be paid');
  if (!booking.boarded_at || booking.code_status !== 'used') {
    throw ApiError.badRequest('Boarding code must be redeemed before payment');
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
const expireStale = async (olderThanHours = 4) => withTransaction(async (client) => {
  const expired = await bookingModel.expireStaleConfirmed(olderThanHours, client);
  for (const booking of expired) {
    if (booking.bus_id) await busModel.adjustSeats(booking.bus_id, 1, client);
    const code = await codeModel.findByBookingId(booking.id, client);
    if (code && code.status === 'valid') await codeModel.invalidate(code.id, client);
    if (booking.driver_id) emitToDriver(booking.driver_id, 'booking:updated', booking);
    emitToUser(booking.passenger_id, 'booking:updated', booking);
  }
  return expired;
});

module.exports = {
  listForUser, getById, create, confirm, cancel, complete, redeemCode,
  rateDriver, expireStale, recordCashPayment,
};
