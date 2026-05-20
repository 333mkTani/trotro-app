const ratingModel = require('../models/rating.model');

const listForDriver = (driverId, opts) => ratingModel.listForDriver(driverId, opts);

module.exports = { listForDriver };
