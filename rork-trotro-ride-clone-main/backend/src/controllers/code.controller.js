const { asyncHandler } = require('../utils/asyncHandler');
const codeService = require('../services/code.service');
const bookingService = require('../services/booking.service');
const scheduleLifecycleService = require('../services/scheduleLifecycle.service');

const getForBooking = asyncHandler(async (req, res) => {
  res.json(await codeService.getForBooking(req.params.bookingId, req.user));
});

const redeem = asyncHandler(async (req, res) => {
  try {
    res.json(await bookingService.redeemCode(req.body.code, req.user));
  } catch (error) {
    if (error.status !== 404) throw error;
    res.json(await scheduleLifecycleService.redeem(req.body.code, req.user.id));
  }
});

const invalidate = asyncHandler(async (req, res) => {
  res.json(await codeService.invalidate(req.params.id));
});

module.exports = { getForBooking, redeem, invalidate };
