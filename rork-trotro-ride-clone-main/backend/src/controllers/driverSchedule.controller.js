const { asyncHandler } = require('../utils/asyncHandler');
const service = require('../services/driverSchedule.service');

const list = asyncHandler(async (req, res) => res.json(await service.listRequests(req.user.id)));
const history = asyncHandler(async (req, res) => res.json(await service.listHistory(req.user.id)));
const getById = asyncHandler(async (req, res) => res.json(await service.getRequest(req.params.id, req.user.id)));
const accept = asyncHandler(async (req, res) => res.json(await service.accept(req.params.id, req.user.id)));
const decline = asyncHandler(async (req, res) => res.json(await service.decline(req.params.id, req.user.id, req.body.reason)));
const withdraw = asyncHandler(async (req, res) => res.json(await service.withdraw(req.params.id, req.user.id, req.body.reason)));

module.exports = { list, history, getById, accept, decline, withdraw };
