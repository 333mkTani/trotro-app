const service = require('../services/paymentOperations.service');
const { asyncHandler } = require('../utils/asyncHandler');

const trace = asyncHandler(async (req, res) => res.json(await service.trace(req.params.id)));
const reconcile = asyncHandler(async (req, res) => res.json(await service.reconcile(req.params.id)));

module.exports = { trace, reconcile };
