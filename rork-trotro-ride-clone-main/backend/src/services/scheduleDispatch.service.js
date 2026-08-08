const occurrenceModel = require('../models/scheduleOccurrence.model');
const profileModel = require('../models/profile.model');
const notificationModel = require('../models/scheduleNotification.model');
const { isScheduledReservationsEnabled } = require('../config/scheduleRollout');
const clock = require('../utils/clock');
const observability = require('../utils/observability');
const push = require('./push.service');
const { emitToDriver, emitToUser } = require('../realtime/io');

const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DEFAULT_HORIZON_DAYS = 14;
const BACKUP_FINAL_LEAD_MINUTES = 120;
const BOARDING_OPEN_LEAD_MINUTES = 60;

// Schedules are currently restricted to Africa/Accra. Ghana has no daylight
// saving transition, so local civil time maps directly to UTC.
const dateKey = (date) => date.toISOString().slice(0, 10);
const atLocalTime = (date, time) => new Date(`${dateKey(date)}T${time.slice(0, 5)}:00.000Z`);
const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

const buildOccurrence = (schedule, serviceDay) => {
  const boardingStart = atLocalTime(serviceDay, schedule.boarding_start_local);
  const boardingEnd = atLocalTime(serviceDay, schedule.boarding_end_local);
  const previousDay = addDays(serviceDay, -1);
  const primaryDeadline = atLocalTime(previousDay, schedule.primary_deadline_local);
  const finalDeadline = schedule.backup_matching_enabled
    ? new Date(boardingStart.getTime() - BACKUP_FINAL_LEAD_MINUTES * 60000)
    : primaryDeadline;
  return {
    scheduleId: schedule.id,
    passengerId: schedule.passenger_id,
    serviceDate: dateKey(serviceDay),
    boardingStartAt: boardingStart.toISOString(),
    boardingEndAt: boardingEnd.toISOString(),
    primaryDeadline: primaryDeadline.toISOString(),
    finalDeadline: finalDeadline.toISOString(),
    boardingOpensAt: new Date(boardingStart.getTime() - BOARDING_OPEN_LEAD_MINUTES * 60000).toISOString(),
  };
};

const generateUpcoming = async (now = clock.now(), horizonDays = DEFAULT_HORIZON_DAYS) => {
  const schedules = await occurrenceModel.listActiveSchedules();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const created = [];
  for (const schedule of schedules) {
    if (!isScheduledReservationsEnabled(schedule.passenger_id)) continue;
    for (let offset = 0; offset <= horizonDays; offset += 1) {
      const serviceDay = addDays(today, offset);
      if (!schedule.travel_days.includes(DAY_CODES[serviceDay.getUTCDay()])) continue;
      const candidate = buildOccurrence(schedule, serviceDay);
      if (new Date(candidate.finalDeadline) <= now) continue;
      const occurrence = await occurrenceModel.insert(candidate);
      if (!occurrence) continue;
      const offers = await occurrenceModel.queueInitialOffers(occurrence.id);
      created.push(occurrence);
      observability.increment('schedule.occurrence.generated');
      observability.increment('schedule.offer.queued', offers);
      observability.log('info', 'schedule.occurrence.generated', {
        occurrenceId: occurrence.id, scheduleId: schedule.id, offers,
      });
    }
  }
  return created;
};

const COPY = {
  schedule_offer: ['Future seat request', 'A commuter needs a future seat. Respond when you know your availability.', 'schedule:offer'],
  schedule_reminder: ['Seat request needs a response', "Tomorrow\'s commuter request is still waiting for a driver.", 'schedule:reminder'],
  schedule_reopened: ['Future seat request reopened', 'A driver withdrew, so this request is available again.', 'schedule:offer'],
  schedule_accepted: ['Seat confirmed', 'A driver accepted your scheduled station reservation.', 'schedule:accepted'],
  schedule_driver_withdrawn: ['Driver availability changed', 'Your driver withdrew. We are searching for another bus.', 'schedule:driver-withdrawn'],
  schedule_unmatched: ['No bus confirmed', 'No driver accepted before the final deadline.', 'schedule:unmatched'],
  schedule_backup_started: ['Backup matching started', 'The primary deadline passed, so backup matching is continuing overnight.', 'schedule:backup-started'],
  schedule_backup_stopped: ['Backup matching stopped', 'The final matching cutoff passed without a driver.', 'schedule:backup-stopped'],
  schedule_boarding_open: ['Boarding code active', 'Boarding is open. Travel to the departure station and show your code.', 'schedule:boarding-open'],
  schedule_boarding_reminder: ['Boarding reminder', 'Your boarding window is approaching at the departure station.', 'schedule:boarding-reminder'],
  schedule_boarding_closed: ['Boarding closed', 'The bus departed and boarding is permanently closed.', 'schedule:boarding-closed'],
  schedule_cancelled: ['Reservation cancelled', 'The scheduled occurrence was cancelled and its future seat released.', 'schedule:cancelled'],
  schedule_expired: ['Reservation expired', 'The boarding window ended and the future seat was released.', 'schedule:expired'],
};
const notificationCopy = (job) => {
  const [title, body, socketEvent] = COPY[job.event_type] || ['Schedule update', 'Your scheduled reservation changed.', 'schedule:updated'];
  return { title, body, socketEvent };
};

const DRIVER_EVENTS = new Set(['schedule_offer', 'schedule_reminder', 'schedule_reopened']);

const deliverNotificationJobs = async () => {
  const jobs = await occurrenceModel.claimNotificationJobs(50);
  let sent = 0;
  for (const job of jobs) {
    try {
      const copy = notificationCopy(job);
      const isDriverEvent = DRIVER_EVENTS.has(job.event_type) || job.payload?.audience === 'driver';
      const deepLink = isDriverEvent ? `/future-requests?occurrenceId=${job.occurrence_id}` : `/(tabs)/schedule?occurrenceId=${job.occurrence_id}`;
      const payload = { ...job.payload, occurrenceId: job.occurrence_id, type: job.event_type, deepLink };
      await notificationModel.createInApp({ ...job, payload }, copy);
      if (isDriverEvent) {
        emitToDriver(job.recipient_id, copy.socketEvent, payload);
      } else {
        emitToUser(job.recipient_id, copy.socketEvent, payload);
      }
      const profile = await profileModel.findById(job.recipient_id);
      if (profile?.fcm_token) {
        await push.send(profile.fcm_token, {
          title: copy.title, body: copy.body, data: payload, throwOnError: true,
        });
      }
      await occurrenceModel.markNotificationSent(job.id);
      sent += 1;
    } catch (error) {
      observability.increment('schedule.notification.failed', 1, { eventType: job.event_type });
      observability.log('error', 'schedule.notification.failed', {
        occurrenceId: job.occurrence_id, jobId: job.id, eventType: job.event_type,
        recipientId: job.recipient_id, error: error?.message || String(error),
      });
      console.error('[schedule-notification] delivery failed', {
        jobId: job.id, occurrenceId: job.occurrence_id, eventType: job.event_type,
        recipientId: job.recipient_id, attempts: job.attempts, error: error?.message || String(error),
      });
      await occurrenceModel.retryNotification(job.id, error?.message || error);
    }
  }
  return sent;
};

const runCycle = async (now = clock.now()) => {
  const created = await generateUpcoming(now);
  const reminders = await occurrenceModel.queueDueReminders(now.toISOString(), 17);
  const backupStarted = await notificationModel.queueBackupStarted(now.toISOString());
  const expired = await occurrenceModel.expireUnmatched(now.toISOString());
  const backupStopped = await notificationModel.queueBackupStopped(expired);
  const notifications = await deliverNotificationJobs();
  observability.increment('schedule.deadline.expired', expired.length);
  observability.increment('schedule.notification.sent', notifications);
  observability.log('info', 'schedule.dispatch.cycle', {
    created: created.length, reminders, backupStarted, backupStopped,
    expired: expired.length, notifications,
  });
  return { created: created.length, reminders, backupStarted, backupStopped, expired: expired.length, notifications };
};

module.exports = {
  buildOccurrence, generateUpcoming, deliverNotificationJobs, runCycle,
  DAY_CODES, DEFAULT_HORIZON_DAYS,
};
