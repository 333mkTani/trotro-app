const { asyncHandler } = require('../utils/asyncHandler');
const routeService = require('../services/route.service');

const list = asyncHandler(async (req, res) => {
  const { city } = req.query;
  res.json(await routeService.list({ city: city || null }));
});

const getById = asyncHandler(async (req, res) => {
  res.json(await routeService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json(await routeService.create(req.body));
});

const update = asyncHandler(async (req, res) => {
  res.json(await routeService.update(req.params.id, req.body));
});

const remove = asyncHandler(async (req, res) => {
  res.json(await routeService.archive(req.params.id));
});

const listStops = asyncHandler(async (req, res) => {
  res.json(await routeService.listStops(req.params.id));
});

const setStops = asyncHandler(async (req, res) => {
  res.json(await routeService.setStops(req.params.id, req.body.stopIds));
});

module.exports = { list, getById, create, update, remove, listStops, setStops };
