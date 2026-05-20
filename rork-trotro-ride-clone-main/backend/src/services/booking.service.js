const { withTransaction } = require('../config/db');
const bookingModel = require('../models/booking.model');
const codeModel = require('../models/code.model');
const busModel = require('../models/bus.model');
const ratingModel = require('../models/rating.model');
const driverModel = require('../models/driver.model');
const { ApiError } = require('../utils/ApiError');
const { generateBoardingCode, buildQrPayload } = require('../utils/codes');

const listForUser = async (user, { status }) => {
  if (user.role === 'driver') return bookingModel.listForDriver(user.id, { status });
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
  return bookingModel.insert({ ...data, passengerId });
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

    const booking = await bookingModel.updateStatus(
      bookingId,
      'confirmed',
      { driverId: driverId ?? existing.driver_id, busId: busId ?? existing.bus_id },
      client,
    );

    const targetBusId = booking.bus_id;
    if (targetBusId) {
      const bus = await busModel.adjustSeats(targetBusId, -1, client);
      if (!bus || bus.seats_available < 0) {
        throw ApiError.conflict('No seats available on this bus');
      }
    }

    const code = generateBoardingCode(6);
    const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const qrPayload = buildQrPayload({ bookingId, code, validUntil });
    const verification = await codeModel.insert(
      { bookingId, code, qrPayload, validUntil },
      client,
    );

    return { booking, code: verification };
  });
};

const cancel = async (bookingId, user) => {
  const existing = await bookingModel.findById(bookingId);
  if (!existing) throw ApiError.notFound('Booking not found');
  if (user.role !== 'admin' && existing.passenger_id !== user.id) throw ApiError.forbidden();
  if (['completed', 'cancelled'].includes(existing.status)) {
    throw ApiError.badRequest(`Cannot cancel a ${existing.status} booking`);
  }
  return withTransaction(async (client) => {
    const booking = await bookingModel.updateStatus(bookingId, 'cancelled', {}, client);
    const code = await codeModel.findByBookingId(bookingId);
    if (code && code.status === 'valid') await codeModel.invalidate(code.id);
    if (existing.status === 'confirmed' && existing.bus_id) {
      await busModel.adjustSeats(existing.bus_id, 1, client);
    }
    return booking;
  });
};

const complete = async (bookingId) => {
  return withTransaction(async (client) => {
    const booking = await bookingModel.updateStatus(bookingId, 'completed', {}, client);
    if (!booking) throw ApiError.notFound('Booking not found');
    const code = await codeModel.findByBookingId(bookingId);
    if (code && code.status === 'valid') await codeModel.markUsed(code.id, client);
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
  return { booking, code: used };
};

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

module.exports = { listForUser, getById, create, confirm, cancel, complete, redeemCode, rateDriver };
