const { asyncHandler } = require('../utils/asyncHandler');
const routingService = require('../services/routing.service');

const directions = asyncHandler(async (req, res) => {
  res.json(await routingService.getDirections(req.query));
});

module.exports = { directions };
