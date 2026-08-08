const { asyncHandler } = require('../utils/asyncHandler');
const service = require('../services/scheduleLifecycle.service');

const getCode = asyncHandler(async (req, res) => res.json(await service.getCode(req.params.id, req.user.id)));
const cancel = asyncHandler(async (req, res) => res.json(await service.cancel(req.params.id, req.user.id)));
const redeem = asyncHandler(async (req, res) => res.json(await service.redeem(req.body.code, req.user.id)));
const depart = asyncHandler(async (req, res) => res.json(await service.depart(req.params.id, req.user.id)));

module.exports = { getCode, cancel, redeem, depart };
