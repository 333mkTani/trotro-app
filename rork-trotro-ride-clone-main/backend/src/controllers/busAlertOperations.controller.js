const { asyncHandler } = require('../utils/asyncHandler');
const service = require('../services/busAlertOperations.service');

const traceAlert = asyncHandler(async (req, res) => res.json(await service.traceAlert(req.params.id)));
const metrics = asyncHandler(async (_req, res) => res.json(service.getMetrics()));
module.exports = { traceAlert, metrics };
