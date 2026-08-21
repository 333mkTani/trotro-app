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

const savePushToken = async (userId, token) => {
  await profileModel.update(userId, { fcmToken: token });
};

const deleteMe = async (userId) => {
  const deleted = await profileModel.deactivate(userId);
  if (!deleted) throw ApiError.notFound('Profile not found');
  return { ok: true };
};

module.exports = { getMe, updateMe, savePushToken, deleteMe };
