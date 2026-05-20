const { asyncHandler } = require('../utils/asyncHandler');
const alertService = require('../services/alert.service');

const list = asyncHandler(async (req, res) => {
  res.json(await alertService.list(req.user.id));
});

const getById = asyncHandler(async (req, res) => {
  res.json(await alertService.getById(req.params.id, req.user));
});

const create = asyncHandler(async (req, res) => {
  res.status(201).json(await alertService.create(req.user.id, req.body));
});

const update = asyncHandler(async (req, res) => {
  res.json(await alertService.update(req.params.id, req.user, req.body));
});

const remove = asyncHandler(async (req, res) => {
  res.json(await alertService.remove(req.params.id, req.user));
});

module.exports = { list, getById, create, update, remove };
