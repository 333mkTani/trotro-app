const { asyncHandler } = require('../utils/asyncHandler');
const service = require('../services/scheduleNotification.service');

const list = asyncHandler(async (req, res) => res.json(await service.list(req.user.id)));
const markRead = asyncHandler(async (req, res) => res.json(await service.markRead(req.params.id, req.user.id)));

module.exports = { list, markRead };
