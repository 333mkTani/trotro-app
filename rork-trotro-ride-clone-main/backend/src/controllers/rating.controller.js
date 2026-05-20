const { asyncHandler } = require('../utils/asyncHandler');
const ratingService = require('../services/rating.service');

const listForDriver = asyncHandler(async (req, res) => {
  res.json(await ratingService.listForDriver(req.params.driverId));
});

module.exports = { listForDriver };
