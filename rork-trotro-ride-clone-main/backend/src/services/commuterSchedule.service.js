const scheduleModel = require('../models/commuterSchedule.model');
const { ApiError } = require('../utils/ApiError');
const { isScheduledReservationsEnabled } = require('../config/scheduleRollout');
const { withTransaction } = require('../config/db');
const notificationModel = require('../models/scheduleNotification.model');
const clock = require('../utils/clock');
const departureSlotModel = require('../models/departureSlot.model');

const list = (passengerId) => scheduleModel.listForPassenger(passengerId);

const getOwned = async (id, user) => {
  const schedule = await scheduleModel.findById(id);
  if (!schedule || schedule.status === 'deleted') throw ApiError.notFound('Commuter schedule not found');
  if (user.role !== 'admin' && schedule.passenger_id !== user.id) throw ApiError.forbidden();
  return schedule;
};

const resolveSlot = async (data) => {
  const slot = await departureSlotModel.findActiveById(data.departureSlotId);
  if (!slot) throw ApiError.notFound('Published departure slot not found');
  if (slot.route_id !== data.routeId || slot.departure_stop_id !== data.departureStopId || slot.destination_stop_id !== data.destinationStopId) {
    throw ApiError.badRequest('Selected departure slot does not match this route and stations');
  }
  if (data.travelDays.some((day) => !slot.travel_days.includes(day))) {
    throw ApiError.badRequest('Selected departure slot is not published for every travel day');
  }
  return slot;
};

const create = async (passengerId, data) => {
  if (!isScheduledReservationsEnabled(passengerId)) {
    throw ApiError.notFound('Scheduled reservations are not enabled');
  }
  const slot = await resolveSlot(data);
  return scheduleModel.insert(passengerId, {
    ...data,
    boardingStartLocal: String(slot.boarding_start_local).slice(0, 5),
    boardingEndLocal: String(slot.boarding_end_local).slice(0, 5),
    timezone: slot.timezone,
  });
};

const update = async (id, user, patch) => {
  const current = await getOwned(id, user);
  const departure = patch.departureStopId ?? current.departure_stop_id;
  const destination = patch.destinationStopId ?? current.destination_stop_id;
  if (departure === destination) throw ApiError.badRequest('Destination must differ from departure station');
  if (!patch.departureSlotId) return scheduleModel.update(id, patch);
  const merged = {
    routeId: patch.routeId ?? current.route_id,
    departureStopId: departure,
    destinationStopId: destination,
    departureSlotId: patch.departureSlotId,
    travelDays: patch.travelDays ?? current.travel_days,
  };
  const slot = await resolveSlot(merged);
  return scheduleModel.update(id, {
    ...patch,
    boardingStartLocal: String(slot.boarding_start_local).slice(0, 5),
    boardingEndLocal: String(slot.boarding_end_local).slice(0, 5),
    timezone: slot.timezone,
  });
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

const listAllOccurrences = (passengerId) => scheduleModel.listAllOccurrencesForPassenger(passengerId);

module.exports = { list, getOwned, create, update, remove, listOccurrences, listAllOccurrences };
