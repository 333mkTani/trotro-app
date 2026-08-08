const scheduleModel = require('../models/commuterSchedule.model');
const { ApiError } = require('../utils/ApiError');
const { isScheduledReservationsEnabled } = require('../config/scheduleRollout');

const list = (passengerId) => scheduleModel.listForPassenger(passengerId);

const getOwned = async (id, user) => {
  const schedule = await scheduleModel.findById(id);
  if (!schedule || schedule.status === 'deleted') throw ApiError.notFound('Commuter schedule not found');
  if (user.role !== 'admin' && schedule.passenger_id !== user.id) throw ApiError.forbidden();
  return schedule;
};

const create = (passengerId, data) => {
  if (!isScheduledReservationsEnabled(passengerId)) {
    throw ApiError.notFound('Scheduled reservations are not enabled');
  }
  return scheduleModel.insert(passengerId, data);
};

const update = async (id, user, patch) => {
  const current = await getOwned(id, user);
  const mergedStart = patch.boardingStartLocal ?? String(current.boarding_start_local).slice(0, 5);
  const mergedEnd = patch.boardingEndLocal ?? String(current.boarding_end_local).slice(0, 5);
  const departure = patch.departureStopId ?? current.departure_stop_id;
  const destination = patch.destinationStopId ?? current.destination_stop_id;
  if (departure === destination) throw ApiError.badRequest('Destination must differ from departure station');
  if (mergedEnd <= mergedStart) throw ApiError.badRequest('Boarding window must end after it starts');
  return scheduleModel.update(id, patch);
};

const remove = async (id, user) => {
  await getOwned(id, user);
  await scheduleModel.update(id, { status: 'deleted' });
  return { ok: true };
};

const listOccurrences = async (id, user) => {
  const schedule = await getOwned(id, user);
  return scheduleModel.listOccurrences(id, schedule.passenger_id);
};

module.exports = { list, getOwned, create, update, remove, listOccurrences };
