const codeModel = require('../models/code.model');
const bookingModel = require('../models/booking.model');
const { ApiError } = require('../utils/ApiError');

const getForBooking = async (bookingId, user) => {
  const booking = await bookingModel.findById(bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  if (user.role !== 'admin' && booking.passenger_id !== user.id && booking.driver_id !== user.id) {
    throw ApiError.forbidden();
  }
  const code = await codeModel.findByBookingId(bookingId);
  if (!code) throw ApiError.notFound('No code issued yet');
  return code;
};

const invalidate = async (id) => {
  const updated = await codeModel.invalidate(id);
  if (!updated) throw ApiError.notFound('Code not found');
  return updated;
};

module.exports = { getForBooking, invalidate };
