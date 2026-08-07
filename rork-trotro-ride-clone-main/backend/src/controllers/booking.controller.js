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
  // A driver claims a booking as themselves — never on another driver's
  // behalf, regardless of what the client sends. Only admins may assign
  // an explicit driverId (e.g. dispatch tooling).
  const effectiveDriverId = req.user.role === 'driver' ? req.user.id : driverId;
  res.json(await bookingService.confirm(req.params.id, { driverId: effectiveDriverId, busId }));
});

const cancel = asyncHandler(async (req, res) => {
  res.json(await bookingService.cancel(req.params.id, req.user));
});

const complete = asyncHandler(async (req, res) => {
  res.json(await bookingService.complete(req.params.id, req.user));
});

const recordCashPayment = asyncHandler(async (req, res) => {
  res.json(await bookingService.recordCashPayment(req.params.id, req.user.id));
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

module.exports = { list, getById, create, confirm, cancel, complete, recordCashPayment, code, redeem, rate };
