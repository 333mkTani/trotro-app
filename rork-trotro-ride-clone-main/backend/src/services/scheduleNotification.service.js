const model = require('../models/scheduleNotification.model');
const { ApiError } = require('../utils/ApiError');

const list = (userId) => model.listForRecipient(userId);
const markRead = async (id, userId) => {
  const notification = await model.markRead(id, userId);
  if (!notification) throw ApiError.notFound('Notification not found');
  return notification;
};

module.exports = { list, markRead };
