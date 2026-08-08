const { query, withTransaction } = require('../config/db');

const queue = async (occurrenceId, recipientId, eventType, payload = {}, client) => {
  const db = client || { query };
  const { rows } = await db.query(
    `insert into public.schedule_notification_jobs (occurrence_id, recipient_id, event_type, payload)
     values ($1,$2,$3,$4::jsonb)
     on conflict (occurrence_id, recipient_id, event_type) do nothing returning *`,
    [occurrenceId, recipientId, eventType, JSON.stringify(payload)],
  );
  return rows[0] || null;
};

const queueBackupStarted = async (now) => withTransaction(async (client) => {
  const { rows } = await client.query(
    `select o.id, o.passenger_id, o.service_date, o.boarding_start_at
       from public.schedule_occurrences o
       join public.commuter_schedules s on s.id = o.schedule_id
      where s.backup_matching_enabled = true and o.assigned_driver_id is null
        and o.status in ('pending','offered')
        and o.primary_acceptance_deadline <= $1 and o.final_acceptance_deadline > $1`, [now],
  );
  let queued = 0;
  for (const occurrence of rows) {
    const job = await queue(occurrence.id, occurrence.passenger_id, 'schedule_backup_started', {
      occurrenceId: occurrence.id, serviceDate: occurrence.service_date,
      boardingStartAt: occurrence.boarding_start_at,
    }, client);
    if (job) queued += 1;
  }
  return queued;
});

const createInApp = async (job, copy) => {
  const { rows } = await query(
    `insert into public.schedule_in_app_notifications
      (occurrence_id, recipient_id, event_type, title, body, payload)
     values ($1,$2,$3,$4,$5,$6::jsonb)
     on conflict (occurrence_id, recipient_id, event_type) do update
       set title = excluded.title, body = excluded.body, payload = excluded.payload
     returning *`,
    [job.occurrence_id, job.recipient_id, job.event_type, copy.title, copy.body, JSON.stringify(job.payload)],
  );
  return rows[0];
};

const listForRecipient = async (recipientId) => {
  const { rows } = await query(
    `select * from public.schedule_in_app_notifications where recipient_id = $1
      order by created_at desc limit 100`, [recipientId],
  );
  return rows;
};

const markRead = async (id, recipientId) => {
  const { rows } = await query(
    `update public.schedule_in_app_notifications set read_at = coalesce(read_at, now())
      where id = $1 and recipient_id = $2 returning *`, [id, recipientId],
  );
  return rows[0] || null;
};

const queueBackupStopped = async (occurrences) => withTransaction(async (client) => {
  let queued = 0;
  for (const occurrence of occurrences) {
    const { rows } = await client.query(
      `select s.backup_matching_enabled from public.schedule_occurrences o
        join public.commuter_schedules s on s.id = o.schedule_id where o.id = $1`, [occurrence.id],
    );
    if (!rows[0]?.backup_matching_enabled) continue;
    const job = await queue(occurrence.id, occurrence.passenger_id, 'schedule_backup_stopped', {
      occurrenceId: occurrence.id, serviceDate: occurrence.service_date,
    }, client);
    if (job) queued += 1;
  }
  return queued;
});

module.exports = { queue, queueBackupStarted, queueBackupStopped, createInApp, listForRecipient, markRead };
