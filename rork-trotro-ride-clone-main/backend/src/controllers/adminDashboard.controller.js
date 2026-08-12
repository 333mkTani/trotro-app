const service = require('../services/adminDashboard.service');
const { asyncHandler } = require('../utils/asyncHandler');

const overview = asyncHandler(async (_req, res) => res.json(await service.overview()));

const series = asyncHandler(async (req, res) =>
  res.json(await service.series(req.query.days)));

const bookings = asyncHandler(async (req, res) =>
  res.json(await service.listBookings({
    status: req.query.status ?? null,
    paymentStatus: req.query.paymentStatus ?? null,
    routeId: req.query.routeId ?? null,
    driverId: req.query.driverId ?? null,
    from: req.query.from ?? null,
    to: req.query.to ?? null,
    search: req.query.search ?? null,
    limit: req.query.limit,
    offset: req.query.offset,
  })));

const fleet = asyncHandler(async (_req, res) => res.json(await service.fleet()));

const routes = asyncHandler(async (req, res) =>
  res.json(await service.listRoutes({
    status: req.query.status || 'all',
    city: req.query.city || null,
  })));

const routePerformance = asyncHandler(async (req, res) =>
  res.json(await service.routePerformance(req.query.days)));

module.exports = { overview, series, bookings, fleet, routes, routePerformance };
