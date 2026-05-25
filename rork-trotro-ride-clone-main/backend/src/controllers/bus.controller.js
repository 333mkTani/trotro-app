const { asyncHandler } = require('../utils/asyncHandler');
const busService = require('../services/bus.service');

const list = asyncHandler(async (req, res) => {
  res.json(await busService.list({ routeId: req.query.routeId }));
});

const getById = asyncHandler(async (req, res) => {
  res.json(await busService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json(await busService.create(req.body));
});

const updateLocation = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;
  res.json(await busService.updateLocation(req.params.id, { lat, lng }));
});

const nearby = asyncHandler(async (req, res) => {
  const { lat, lng, radius_m: radiusM, limit, routeId } = req.query;
  res.json(await busService.nearby({ lat, lng, radiusM, limit, routeId }));
});

const listActive = asyncHandler(async (req, res) => {
  res.json(await busService.listActive());
});

module.exports = { list, getById, create, updateLocation, nearby, listActive };
