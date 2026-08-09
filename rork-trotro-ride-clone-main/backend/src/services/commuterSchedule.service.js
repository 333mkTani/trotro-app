const scheduleModel = require('../models/commuterSchedule.model');
const { ApiError } = require('../utils/ApiError');
const { isScheduledReservationsEnabled } = require('../config/scheduleRollout');
const { withTransaction } = require('../config/db');
const notificationModel = require('../models/scheduleNotification.model');
const clock = require('../utils/clock');

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
  const schedule = await getOwned(id, user);
  const result = await withTransaction(async (client) => {
    const removed = await scheduleModel.removeAndCancelFuture(
      id,
      schedule.passenger_id,
      clock.now(),
      client,
    );
    if (!removed) throw ApiError.notFound('Commuter schedule not found');
    for (const occurrence of removed.occurrences) {
      const payload = { occurrenceId: occurrence.id, serviceDate: occurrence.service_date };
      await notificationModel.queue(
        occurrence.id,
        occurrence.passenger_id,
        'schedule_cancelled',
        payload,
        client,
      );
      if (occurrence.assigned_driver_id) {
        await notificationModel.queue(
          occurrence.id,
          occurrence.assigned_driver_id,
          'schedule_cancelled',
          { ...payload, audience: 'driver' },
          client,
        );
      }
    }
    return removed;
  });
  return { ok: true, cancelledOccurrences: result.occurrences.length };
};

const listOccurrences = async (id, user) => {
  const schedule = await getOwned(id, user);
  return scheduleModel.listOccurrences(id, schedule.passenger_id);
};

module.exports = { list, getOwned, create, update, remove, listOccurrences };
