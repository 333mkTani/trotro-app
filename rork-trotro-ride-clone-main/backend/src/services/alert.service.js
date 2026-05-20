const alertModel = require('../models/alert.model');
const { ApiError } = require('../utils/ApiError');

const list = (passengerId) => alertModel.listForPassenger(passengerId);

const getById = async (id, user) => {
  const a = await alertModel.findById(id);
  if (!a) throw ApiError.notFound('Alert not found');
  if (user.role !== 'admin' && a.passenger_id !== user.id) throw ApiError.forbidden();
  return a;
};

const create = (passengerId, data) => alertModel.insert({ ...data, passengerId });

const update = async (id, user, patch) => {
  await getById(id, user);
  return alertModel.update(id, patch);
};

const remove = async (id, user) => {
  await getById(id, user);
  await alertModel.remove(id);
  return { ok: true };
};

module.exports = { list, getById, create, update, remove };
