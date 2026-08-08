const deliveryModel = require('../models/busAlertDelivery.model');
const busService = require('./bus.service');
const push = require('./push.service');
const { emitToUser } = require('../realtime/io');
const observability = require('../utils/observability');
const clock = require('../utils/clock');
const { isBusAlertsEnabled } = require('../config/busAlertRollout');

const DAY_CODES = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

const localParts = (date, timezone) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'Africa/Accra', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return {
    day: parts.weekday,
    localDate: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
};

const scheduledMinutes = (schedule, day) => {
  if (!schedule?.days?.includes(day)) return null;
  if (schedule.time_mode === 'same') {
    if (schedule.same_hour == null || schedule.same_minute == null) return null;
    return Number(schedule.same_hour) * 60 + Number(schedule.same_minute);
  }
  const entry = schedule.custom_times?.find((item) => item.day === day);
  return entry ? Number(entry.hour) * 60 + Number(entry.minute) : null;
};

const dueFor = (alert, now) => {
  if (!alert.is_active) return null;
  if (!alert.schedule) {
    const alertTime = new Date(alert.alert_time);
    if (Number.isNaN(alertTime.getTime()) || alertTime > now || alert.triggered) return null;
    const parts = localParts(alertTime, alert.timezone);
    return { localDate: parts.localDate, scheduledFor: alertTime.toISOString() };
  }
  const parts = localParts(now, alert.timezone);
  if (!DAY_CODES.has(parts.day) || String(alert.last_triggered_day || '') === parts.localDate) return null;
  const target = scheduledMinutes(alert.schedule, parts.day);
  if (target == null || parts.minutes < target) return null;
  return { localDate: parts.localDate, scheduledFor: now.toISOString() };
};

const evaluateDue = async (now = clock.now()) => {
  const alerts = await deliveryModel.listActive();
  let created = 0;
  for (const alert of alerts) {
    observability.increment('bus_alert.evaluated');
    if (!isBusAlertsEnabled(alert.passenger_id)) {
      observability.increment('bus_alert.skipped', 1, { reason: 'rollout' });
      continue;
    }
    const due = dueFor(alert, now);
    if (!due) {
      observability.increment('bus_alert.skipped', 1, { reason: 'not_due' });
      continue;
    }
    const trigger = await deliveryModel.createTrigger(alert, due);
    if (!trigger) {
      observability.increment('bus_alert.skipped', 1, { reason: 'idempotency' });
      continue;
    }
    created += 1;
    observability.increment('bus_alert.trigger.created');
    observability.log('info', 'bus_alert.trigger.created', {
      alertId: alert.id, triggerOccurrenceId: trigger.id, localDate: due.localDate,
    });
  }
  return created;
};

const deliverDue = async () => {
  const jobs = await deliveryModel.claimJobs(50);
  let delivered = 0;
  for (const job of jobs) {
    try {
      const context = await deliveryModel.getDeliveryContext(job.trigger_occurrence_id);
      if (!context) throw new Error('Bus alert trigger context not found');
      if (context.status !== 'pending') throw new Error(`Bus alert trigger is ${context.status}`);
      const buses = await busService.listApproachingStop({
        stopId: context.stop_id, routeName: context.route_id ? context.route_name : undefined,
      });
      const title = buses.length ? 'Buses are approaching' : 'Bus alert check';
      const body = buses.length
        ? `${buses.length} bus${buses.length === 1 ? '' : 'es'} approaching ${context.stop_name}.`
        : `No available buses are approaching ${context.stop_name} yet.`;
      const payload = {
        type: 'bus_alert', alertId: context.alert_id,
        triggerOccurrenceId: context.id, busCount: buses.length,
        deepLink: `/alert-buses?alertId=${context.alert_id}`,
      };
      const notificationsEnabled = context.bus_alerts_enabled !== false;
      const persisted = await deliveryModel.persistDelivery(
        context, buses, { title, body }, payload, notificationsEnabled,
      );
      if (persisted === false) {
        observability.increment('bus_alert.skipped', 1, { reason: 'cancelled' });
        observability.log('info', 'bus_alert.delivery.cancelled', {
          alertId: context.alert_id, triggerOccurrenceId: context.id, jobId: job.id,
        });
        continue;
      }
      if (notificationsEnabled) emitToUser(context.passenger_id, 'bus-alert:triggered', { ...payload, buses });
      if (notificationsEnabled && context.fcm_token) {
        await push.send(context.fcm_token, { title, body, data: payload, throwOnError: true });
      }
      await deliveryModel.markSent(job.id, context.id);
      delivered += 1;
      observability.increment(notificationsEnabled ? 'bus_alert.delivered' : 'bus_alert.skipped', 1,
        notificationsEnabled ? {} : { reason: 'preference' });
      observability.log('info', 'bus_alert.delivery.completed', {
        alertId: context.alert_id, triggerOccurrenceId: context.id, jobId: job.id,
        busCount: buses.length, notificationsEnabled,
      });
    } catch (error) {
      const status = await deliveryModel.retry(job.id, error?.message || error);
      observability.increment(status === 'dead_letter' ? 'bus_alert.failed' : 'bus_alert.retried');
      observability.log('error', 'bus_alert.notification.failed', {
        jobId: job.id, triggerOccurrenceId: job.trigger_occurrence_id, status,
        error: error?.message || String(error),
      });
    }
  }
  return delivered;
};

const runCycle = async (now = clock.now()) => {
  const triggered = await evaluateDue(now);
  const delivered = await deliverDue();
  if (triggered || delivered) {
    observability.log('info', 'bus_alert.worker.cycle', { triggered, delivered });
  }
  return { triggered, delivered };
};

module.exports = { localParts, scheduledMinutes, dueFor, evaluateDue, deliverDue, runCycle };
