const { asyncHandler } = require('../utils/asyncHandler');
const routeService = require('../services/route.service');

const list = asyncHandler(async (_req, res) => {
  res.json(await routeService.list());
});

const getById = asyncHandler(async (req, res) => {
  res.json(await routeService.getById(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json(await routeService.create(req.body));
});

module.exports = { list, getById, create };
