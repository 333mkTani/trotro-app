const profileModel = require('../models/profile.model');
const { ApiError } = require('../utils/ApiError');

const getMe = async (userId) => {
  const me = await profileModel.findById(userId);
  if (!me) throw ApiError.notFound('Profile not found');
  return me;
};

const updateMe = async (userId, patch) => {
  const updated = await profileModel.update(userId, patch);
  if (!updated) throw ApiError.notFound('Profile not found');
  return updated;
};

module.exports = { getMe, updateMe };
