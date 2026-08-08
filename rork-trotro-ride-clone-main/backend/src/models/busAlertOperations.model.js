const { query } = require('../config/db');

const traceAlert = async (alertId) => {
  const statements = {
    alert: `select a.*, p.bus_alerts_enabled from public.bus_alerts a
      join public.profiles p on p.id = a.passenger_id where a.id = $1`,
    occurrences: `select * from public.bus_alert_trigger_occurrences
      where alert_id = $1 order by created_at`,
    jobs: `select j.* from public.bus_alert_notification_jobs j
      join public.bus_alert_trigger_occurrences t on t.id = j.trigger_occurrence_id
      where t.alert_id = $1 order by j.created_at`,
    notifications: `select * from public.bus_alert_in_app_notifications
      where alert_id = $1 order by created_at`,
  };
  const entries = await Promise.all(Object.entries(statements).map(async ([key, sql]) => {
    const { rows } = await query(sql, [alertId]);
    return [key, rows];
  }));
  const trace = Object.fromEntries(entries);
  return trace.alert[0] ? { ...trace, alert: trace.alert[0] } : null;
};

module.exports = { traceAlert };
