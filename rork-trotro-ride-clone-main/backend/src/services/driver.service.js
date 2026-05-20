const driverModel = require('../models/driver.model');
const ratingModel = require('../models/rating.model');
const { ApiError } = require('../utils/ApiError');

const list = (opts) => driverModel.list(opts);

const getById = async (id) => {
  const d = await driverModel.findById(id);
  if (!d) throw ApiError.notFound('Driver not found');
  return d;
};

const ratings = (id) => ratingModel.listForDriver(id);

const create = (data) => driverModel.insert(data);

module.exports = { list, getById, ratings, create };
