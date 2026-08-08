const { asyncHandler } = require('../utils/asyncHandler');
const service = require('../services/scheduleOperations.service');

const traceOccurrence = asyncHandler(async (req, res) => res.json(await service.traceOccurrence(req.params.id)));
const metrics = asyncHandler(async (_req, res) => res.json(service.getMetrics()));

module.exports = { traceOccurrence, metrics };
