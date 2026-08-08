const { withTransaction } = require('../config/db');
const lifecycleModel = require('../models/scheduleLifecycle.model');
const notificationModel = require('../models/scheduleNotification.model');
const bookingModel = require('../models/booking.model');
const busModel = require('../models/bus.model');
const codeModel = require('../models/code.model');
const { generateBoardingCode, buildQrPayload } = require('../utils/codes');
const { ApiError } = require('../utils/ApiError');
const clock = require('../utils/clock');

const activateDue = (now = clock.now()) => withTransaction(async (client) => {
  const opened = await lifecycleModel.openDue(now, client);
  for (const occurrence of opened) {
    const code = generateBoardingCode(6);
    const validUntil = new Date(occurrence.boarding_end_at).toISOString();
    const qrPayload = buildQrPayload({ occurrenceId: occurrence.id, code, validUntil });
    await lifecycleModel.insertCode(occurrence, code, qrPayload, client);
    const payload = { occurrenceId: occurrence.id, serviceDate: occurrence.service_date,
      boardingStartAt: occurrence.boarding_start_at, boardingEndAt: occurrence.boarding_end_at };
    await notificationModel.queue(occurrence.id, occurrence.passenger_id,
      'schedule_boarding_open', payload, client);
    await notificationModel.queue(occurrence.id, occurrence.passenger_id,
      'schedule_boarding_reminder', payload, client);
  }
  return opened;
});

const getCode = async (occurrenceId, passengerId) => {
  const code = await lifecycleModel.findPassengerCode(occurrenceId, passengerId);
  if (!code) throw ApiError.notFound('Boarding code is not active yet');
  return code;
};

const redeem = (code, driverId, now = clock.now()) => withTransaction(async (client) => {
  const record = await lifecycleModel.lockByCode(code, client);
  if (!record) throw ApiError.notFound('Boarding code not found');
  if (record.assigned_driver_id !== driverId) throw ApiError.forbidden('Code is assigned to another driver');
  if (record.status === 'used' && record.booking_id) {
    return { booking: await bookingModel.findById(record.booking_id, client), occurrenceId: record.occurrence_id };
  }
  if (record.status !== 'active') throw ApiError.badRequest(`Code is ${record.status}`);
  if (record.occurrence_status !== 'boarding_open') throw ApiError.badRequest('Boarding is not open');
  if (now < new Date(record.valid_from)) throw ApiError.badRequest('Boarding code is not active yet');
  if (now > new Date(record.valid_until)) throw ApiError.badRequest('Boarding code expired');

  const bus = await busModel.reserveSeat(record.assigned_bus_id, client);
  if (!bus) throw ApiError.conflict('The bus has no live seats available');
  const booking = await bookingModel.insert({
    passengerId: record.passenger_id, driverId, busId: record.assigned_bus_id,
    routeId: record.route_id, pickupStopId: record.departure_stop_id,
    pickupStopName: record.departure_stop_name, destinationStopId: record.destination_stop_id,
    destinationStopName: record.destination_stop_name, desiredArrivalTime: record.boarding_end_at,
    bufferMinutes: 10, status: 'confirmed', routeName: record.route_name,
    rideFare: record.route_fare, sourceOccurrenceId: record.occurrence_id,
  }, client);
  const occurrence = await lifecycleModel.markBoarded(record, booking.id, client);
  if (!occurrence) throw ApiError.conflict('Boarding was already closed');
  const ordinaryCode = await codeModel.insert({ bookingId: booking.id, code: record.code,
    qrPayload: record.qr_payload, validUntil: record.valid_until }, client);
  await codeModel.markUsed(ordinaryCode.id, client);
  const boardedBooking = await bookingModel.markBoarded(booking.id, client);
  return { booking: boardedBooking, occurrence };
});

const cancel = (occurrenceId, passengerId, now = clock.now()) => withTransaction(async (client) => {
  const occurrence = await lifecycleModel.cancel(occurrenceId, passengerId, now, client);
  if (!occurrence) throw ApiError.badRequest('Occurrence cannot be cancelled after boarding opens or is already terminal');
  const payload = { occurrenceId: occurrence.id, serviceDate: occurrence.service_date };
  await notificationModel.queue(occurrence.id, occurrence.passenger_id, 'schedule_cancelled', payload, client);
  if (occurrence.assigned_driver_id) {
    await notificationModel.queue(occurrence.id, occurrence.assigned_driver_id,
      'schedule_cancelled', { ...payload, audience: 'driver' }, client);
  }
  return occurrence;
});

const depart = (occurrenceId, driverId, now = clock.now()) => withTransaction(async (client) => {
  const occurrence = await lifecycleModel.depart(occurrenceId, driverId, now, client);
  if (!occurrence) throw ApiError.badRequest('Only the assigned driver can close an open boarding occurrence');
  await notificationModel.queue(occurrence.id, occurrence.passenger_id,
    occurrence.status === 'expired' ? 'schedule_expired' : 'schedule_boarding_closed',
    { occurrenceId: occurrence.id, serviceDate: occurrence.service_date }, client);
  return occurrence;
});

const expireNoShows = (now = clock.now()) => withTransaction(async (client) => {
  const expired = await lifecycleModel.expireNoShows(now, client);
  for (const occurrence of expired) {
    const payload = { occurrenceId: occurrence.id, serviceDate: occurrence.service_date };
    await notificationModel.queue(occurrence.id, occurrence.passenger_id, 'schedule_expired', payload, client);
    if (occurrence.assigned_driver_id) {
      await notificationModel.queue(occurrence.id, occurrence.assigned_driver_id,
        'schedule_expired', { ...payload, audience: 'driver' }, client);
    }
  }
  return expired;
});

const runCycle = async (now = clock.now()) => {
  const opened = await activateDue(now);
  const expired = await expireNoShows(now);
  return { opened: opened.length, noShows: expired.length };
};

module.exports = { activateDue, getCode, redeem, cancel, depart, expireNoShows, runCycle };
