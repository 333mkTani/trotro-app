const { asyncHandler } = require('../utils/asyncHandler');
const stopService = require('../services/stop.service');

const list = asyncHandler(async (_req, res) => {
  res.json(await stopService.list());
});

const getById = asyncHandler(async (req, res) => {
  res.json(await stopService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json(await stopService.create(req.body));
});

const nearby = asyncHandler(async (req, res) => {
  const { lat, lng, radius_m: radiusM, limit } = req.query;
  res.json(await stopService.nearby({ lat, lng, radiusM, limit }));
});

module.exports = { list, getById, create, nearby };
