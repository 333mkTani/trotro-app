const { asyncHandler } = require('../utils/asyncHandler');
const service = require('../services/departureSlot.service');

const mine = asyncHandler(async (req, res) => res.json(await service.listMine(req.user.id)));
const published = asyncHandler(async (req, res) => res.json(await service.listPublished(req.query)));
const create = asyncHandler(async (req, res) => res.status(201).json(await service.create(req.user.id, req.body)));
const remove = asyncHandler(async (req, res) => res.json(await service.remove(req.params.id, req.user.id)));

module.exports = { mine, published, create, remove };

