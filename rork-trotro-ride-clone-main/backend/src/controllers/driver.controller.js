const { asyncHandler } = require('../utils/asyncHandler');
const driverService = require('../services/driver.service');

const list = asyncHandler(async (_req, res) => {
  res.json(await driverService.list());
});

const getById = asyncHandler(async (req, res) => {
  res.json(await driverService.getById(req.params.id));
});

const ratings = asyncHandler(async (req, res) => {
  res.json(await driverService.ratings(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json(await driverService.create(req.body));
});

module.exports = { list, getById, ratings, create };
