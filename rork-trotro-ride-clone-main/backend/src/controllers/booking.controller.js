const { asyncHandler } = require('../utils/asyncHandler');
const bookingService = require('../services/booking.service');
const codeService = require('../services/code.service');
const bookingPaymentService = require('../services/bookingPayment.service');

const list = asyncHandler(async (req, res) => {
  res.json(await bookingService.listForUser(req.user, { status: req.query.status }));
});

const getById = asyncHandler(async (req, res) => {
  res.json(await bookingService.getById(req.params.id, req.user));
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json(await bookingService.create(req.user.id, req.body));
});

const createProvisional = asyncHandler(async (req, res) => {
  res.status(201).json(await bookingService.createProvisional(req.user.id, req.body));
});

const initializeDeposit = asyncHandler(async (req, res) => {
  res.status(201).json(
    await bookingPaymentService.initializeDeposit(req.user.id, req.params.id, req.body),
  );
});

const verifyDeposit = asyncHandler(async (req, res) => {
  const result = await bookingPaymentService.verifyDeposit(
    req.user.id, req.params.id, req.body.reference,
  );
  res.status(result.success ? 200 : 402).json(result);
});

const initializeBalance = asyncHandler(async (req, res) => {
  res.status(201).json(
    await bookingPaymentService.initializeBalance(req.user.id, req.params.id, req.body),
  );
});

const verifyBalance = asyncHandler(async (req, res) => {
  const result = await bookingPaymentService.verifyBalance(
    req.user.id, req.params.id, req.body.reference,
  );
  res.status(result.success ? 200 : 402).json(result);
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

module.exports = {
  list, getById, create, createProvisional, confirm, cancel, complete,
  initializeDeposit, verifyDeposit, initializeBalance, verifyBalance,
  recordCashPayment, code, redeem, rate,
};
