const { asyncHandler } = require('../utils/asyncHandler');
const scheduleService = require('../services/commuterSchedule.service');

const list = asyncHandler(async (req, res) => res.json(await scheduleService.list(req.user.id)));
const getById = asyncHandler(async (req, res) => res.json(await scheduleService.getOwned(req.params.id, req.user)));
const create = asyncHandler(async (req, res) => res.status(201).json(await scheduleService.create(req.user.id, req.body)));
const update = asyncHandler(async (req, res) => res.json(await scheduleService.update(req.params.id, req.user, req.body)));
const remove = asyncHandler(async (req, res) => res.json(await scheduleService.remove(req.params.id, req.user)));
const occurrences = asyncHandler(async (req, res) => res.json(await scheduleService.listOccurrences(req.params.id, req.user)));

module.exports = { list, getById, create, update, remove, occurrences };
