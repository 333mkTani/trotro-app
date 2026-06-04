const { asyncHandler } = require('../utils/asyncHandler');
const bookingService = require('../services/booking.service');
const codeService = require('../services/code.service');

const list = asyncHandler(async (req, res) => {
  res.json(await bookingService.listForUser(req.user, { status: req.query.status }));
});

const getById = asyncHandler(async (req, res) => {
  res.json(await bookingService.getById(req.params.id, req.user));
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json(await bookingService.create(req.user.id, req.body));
});

const confirm = asyncHandler(async (req, res) => {
  const { driverId, busId } = req.body || {};
  res.json(await bookingService.confirm(req.params.id, { driverId, busId }));
});

const cancel = asyncHandler(async (req, res) => {
  res.json(await bookingService.cancel(req.params.id, req.user));
});

const complete = asyncHandler(async (req, res) => {
  res.json(await bookingService.complete(req.params.id, req.user));
});

const code = asyncHandler(async (req, res) => {
  res.json(await codeService.getForBooking(req.params.id, req.user));
});

const redeem = asyncHandler(async (req, res) => {
  res.json(await bookingService.redeemCode(req.body.code, req.user));
});

const rate = asyncHandler(async (req, res) => {
  res.status(201).json(await bookingService.rateDriver(req.params.id, req.user.id, req.body));
});

module.exports = { list, getById, create, confirm, cancel, complete, code, redeem, rate };
