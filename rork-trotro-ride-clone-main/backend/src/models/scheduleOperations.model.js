const { query } = require('../config/db');

const traceOccurrence = async (occurrenceId) => {
  const statements = {
    occurrence: `select o.*, s.status as schedule_status, s.route_id from public.schedule_occurrences o join public.commuter_schedules s on s.id = o.schedule_id where o.id = $1`,
    responses: `select * from public.driver_schedule_responses where occurrence_id = $1 order by responded_at`,
    reservations: `select * from public.future_reservations where occurrence_id = $1 order by held_at`,
    boardingCodes: `select id, occurrence_id, status, valid_from, valid_until, used_at, booking_id from public.schedule_boarding_codes where occurrence_id = $1`,
    notificationJobs: `select id, recipient_id, event_type, status, attempts, last_error, next_attempt_at, sent_at, created_at from public.schedule_notification_jobs where occurrence_id = $1 order by created_at`,
    inAppNotifications: `select id, recipient_id, event_type, read_at, created_at from public.schedule_in_app_notifications where occurrence_id = $1 order by created_at`,
  };
  const entries = await Promise.all(Object.entries(statements).map(async ([key, sql]) => {
    const { rows } = await query(sql, [occurrenceId]);
    return [key, rows];
  }));
  const trace = Object.fromEntries(entries);
  return trace.occurrence[0] ? { ...trace, occurrence: trace.occurrence[0] } : null;
};

module.exports = { traceOccurrence };
