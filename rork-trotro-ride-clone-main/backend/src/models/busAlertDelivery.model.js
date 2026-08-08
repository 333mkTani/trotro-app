const { query, withTransaction } = require('../config/db');

const listActive = async () => {
  const { rows } = await query(
    `select id, passenger_id, route_id, route_name, stop_id, stop_name,
            alert_time, schedule, timezone, is_active, triggered, last_triggered_day
       from public.bus_alerts where is_active = true order by created_at limit 1000`,
  );
  return rows;
};

const createTrigger = (alert, due) => withTransaction(async (client) => {
  const { rows: locked } = await client.query(
    `select * from public.bus_alerts where id = $1 for update`, [alert.id],
  );
  const current = locked[0];
  if (!current?.is_active) return null;
  if (current.schedule && String(current.last_triggered_day || '') === due.localDate) return null;
  if (!current.schedule && current.triggered) return null;

  const { rows } = await client.query(
    `insert into public.bus_alert_trigger_occurrences
       (alert_id, passenger_id, local_date, scheduled_for)
     values ($1,$2,$3,$4)
     on conflict (alert_id, local_date) do nothing returning *`,
    [current.id, current.passenger_id, due.localDate, due.scheduledFor],
  );
  const trigger = rows[0];
  if (!trigger) return null;

  await client.query(
    `update public.bus_alerts
        set triggered = true, last_triggered_day = $2,
            is_active = case when schedule is null then false else is_active end
      where id = $1`, [current.id, due.localDate],
  );
  await client.query(
    `insert into public.bus_alert_notification_jobs (trigger_occurrence_id, recipient_id)
     values ($1,$2) on conflict (trigger_occurrence_id, recipient_id) do nothing`,
    [trigger.id, current.passenger_id],
  );
  return { ...trigger, alert: current };
});

const claimJobs = async (limit = 50) => withTransaction(async (client) => {
  const { rows } = await client.query(
    `with claimed as (
       select j.id from public.bus_alert_notification_jobs j
       join public.bus_alert_trigger_occurrences t on t.id = j.trigger_occurrence_id
        where (j.status = 'pending' and j.next_attempt_at <= now()
               or j.status = 'processing' and j.processing_started_at < now() - interval '5 minutes')
          and t.status = 'pending'
        order by j.created_at for update of j skip locked limit $1
     )
     update public.bus_alert_notification_jobs j
        set status = 'processing', attempts = attempts + 1, processing_started_at = now()
       from claimed where j.id = claimed.id returning j.*`, [limit],
  );
  return rows;
});

const getDeliveryContext = async (triggerId) => {
  const { rows } = await query(
    `select t.*, a.route_id, a.route_name, a.stop_id, a.stop_name, a.timezone,
            p.fcm_token, p.bus_alerts_enabled
       from public.bus_alert_trigger_occurrences t
       join public.bus_alerts a on a.id = t.alert_id
       join public.profiles p on p.id = t.passenger_id
      where t.id = $1`, [triggerId],
  );
  return rows[0] || null;
};

const persistDelivery = (context, buses, copy, payload, notify = true) => withTransaction(async (client) => {
  const { rows: locked } = await client.query(
    `select status from public.bus_alert_trigger_occurrences where id = $1 for update`, [context.id],
  );
  if (locked[0]?.status !== 'pending') return false;
  await client.query(
    `update public.bus_alert_trigger_occurrences set buses = $2::jsonb where id = $1`,
    [context.id, JSON.stringify(buses)],
  );
  await client.query(
    `update public.bus_alerts set triggered_buses = $2::jsonb where id = $1`,
    [context.alert_id, JSON.stringify(buses)],
  );
  if (notify) await client.query(
    `insert into public.bus_alert_in_app_notifications
       (trigger_occurrence_id, alert_id, recipient_id, title, body, payload)
     values ($1,$2,$3,$4,$5,$6::jsonb)
     on conflict (trigger_occurrence_id) do update
       set title = excluded.title, body = excluded.body, payload = excluded.payload`,
    [context.id, context.alert_id, context.passenger_id, copy.title, copy.body, JSON.stringify(payload)],
  );
  return true;
});

const markSent = (id, triggerId) => withTransaction(async (client) => {
  await client.query(
    `update public.bus_alert_notification_jobs
        set status = 'sent', sent_at = now(), last_error = null, processing_started_at = null
      where id = $1 and status = 'processing'`, [id],
  );
  await client.query(
    `update public.bus_alert_trigger_occurrences
        set status = 'delivered', delivered_at = coalesce(delivered_at, now())
      where id = $1 and status = 'pending'`, [triggerId],
  );
});

const retry = async (id, error) => {
  const { rows } = await query(
  `update public.bus_alert_notification_jobs
      set status = case when attempts >= 6 then 'dead_letter' else 'pending' end,
          last_error = $2, processing_started_at = null,
          next_attempt_at = now() + (least(attempts, 6) * interval '1 minute')
    where id = $1 and status = 'processing' returning status`,
  [id, String(error).slice(0, 500)]);
  return rows[0]?.status || null;
};

const cancelPendingForAlert = (alertId) => withTransaction(async (client) => {
  const { rows } = await client.query(
    `update public.bus_alert_trigger_occurrences set status = 'cancelled'
      where alert_id = $1 and status = 'pending' returning id`, [alertId],
  );
  if (rows.length) {
    await client.query(
      `update public.bus_alert_notification_jobs set status = 'cancelled'
        where trigger_occurrence_id = any($1::uuid[]) and status in ('pending','processing')`,
      [rows.map((row) => row.id)],
    );
  }
  return rows.length;
});

module.exports = {
  listActive, createTrigger, claimJobs, getDeliveryContext, persistDelivery,
  markSent, retry, cancelPendingForAlert,
};
