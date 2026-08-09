const { query, withTransaction } = require('../config/db');

const listActiveSchedules = async () => {
  const { rows } = await query(
    `select s.*,
            coalesce(ds.boarding_start_local, s.boarding_start_local) as boarding_start_local,
            coalesce(ds.boarding_end_local, s.boarding_end_local) as boarding_end_local,
            coalesce(ds.travel_days, s.travel_days) as slot_travel_days
       from public.commuter_schedules s
       left join public.driver_departure_slots ds on ds.id = s.departure_slot_id and ds.status = 'active'
      where s.status = 'active' and (s.departure_slot_id is null or ds.id is not null)
      order by s.created_at`,
  );
  return rows;
};

const insert = async (data) => {
  const { rows } = await query(
    `insert into public.schedule_occurrences
      (schedule_id, passenger_id, service_date, boarding_start_at, boarding_end_at,
       primary_acceptance_deadline, final_acceptance_deadline, boarding_opens_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (schedule_id, service_date) do nothing
     returning *`,
    [data.scheduleId, data.passengerId, data.serviceDate, data.boardingStartAt,
      data.boardingEndAt, data.primaryDeadline, data.finalDeadline, data.boardingOpensAt],
  );
  return rows[0] || null;
};

const queueInitialOffers = async (occurrenceId) => withTransaction(async (client) => {
  const { rows: occurrences } = await client.query(
    `update public.schedule_occurrences
        set status = case when status = 'pending' then 'offered' else status end,
            first_offered_at = coalesce(first_offered_at, now()), updated_at = now()
      where id = $1 and assigned_driver_id is null
      returning *`,
    [occurrenceId],
  );
  if (!occurrences[0]) return 0;
  const { rowCount } = await client.query(
    `insert into public.schedule_notification_jobs
      (occurrence_id, recipient_id, event_type, payload)
     select o.id, b.driver_id, 'schedule_offer',
            jsonb_build_object('occurrenceId', o.id, 'scheduleId', o.schedule_id,
              'serviceDate', o.service_date, 'boardingStartAt', o.boarding_start_at)
       from public.schedule_occurrences o
       join public.commuter_schedules s on s.id = o.schedule_id
       join public.buses b on b.route_id = s.route_id and b.driver_id is not null
       join public.drivers d on d.id = b.driver_id and d.status = 'active'
      where o.id = $1 and b.status <> 'deleted'
     on conflict (occurrence_id, recipient_id, event_type) do nothing`,
    [occurrenceId],
  );
  return rowCount;
});

const queueDueReminders = async (now, reminderHourUtc = 17) => {
  const { rows } = await query(
    `with due as (
       update public.schedule_occurrences o
          set reminder_queued_at = $1, updated_at = now()
         from public.commuter_schedules s
        where s.id = o.schedule_id
          and o.assigned_driver_id is null
          and o.status in ('pending','offered')
          and o.reminder_queued_at is null
          and o.service_date = (($1 at time zone 'Africa/Accra')::date + 1)
          and extract(hour from ($1 at time zone 'Africa/Accra')) >= $2
          and o.primary_acceptance_deadline > $1
        returning o.*, s.route_id
     )
     insert into public.schedule_notification_jobs
       (occurrence_id, recipient_id, event_type, payload)
     select due.id, b.driver_id, 'schedule_reminder',
            jsonb_build_object('occurrenceId', due.id, 'serviceDate', due.service_date,
              'boardingStartAt', due.boarding_start_at)
       from due
       join public.buses b on b.route_id = due.route_id and b.driver_id is not null
       join public.drivers d on d.id = b.driver_id and d.status = 'active'
      where b.status <> 'deleted'
     on conflict (occurrence_id, recipient_id, event_type) do nothing
     returning occurrence_id`,
    [now, reminderHourUtc],
  );
  return rows.length;
};

const expireUnmatched = async (now) => withTransaction(async (client) => {
  const { rows } = await client.query(
    `update public.schedule_occurrences
        set status = 'unmatched', expired_at = $1, updated_at = now()
      where assigned_driver_id is null
        and status in ('pending','offered')
        and final_acceptance_deadline <= $1
      returning *`,
    [now],
  );
  for (const occurrence of rows) {
    await client.query(
      `insert into public.schedule_notification_jobs
        (occurrence_id, recipient_id, event_type, payload)
       values ($1,$2,'schedule_unmatched',$3::jsonb)
       on conflict (occurrence_id, recipient_id, event_type) do nothing`,
      [occurrence.id, occurrence.passenger_id, JSON.stringify({
        occurrenceId: occurrence.id, serviceDate: occurrence.service_date,
      })],
    );
  }
  return rows;
});

const claimNotificationJobs = async (limit = 50) => withTransaction(async (client) => {
  const { rows } = await client.query(
    `with claimed as (
       select id from public.schedule_notification_jobs
        where status = 'pending' and next_attempt_at <= now()
        order by created_at
        for update skip locked limit $1
     )
     update public.schedule_notification_jobs j
        set status = 'processing', attempts = attempts + 1
       from claimed where j.id = claimed.id
     returning j.*`,
    [limit],
  );
  return rows;
});

const markNotificationSent = (id) => query(
  `update public.schedule_notification_jobs set status = 'sent', sent_at = now(), last_error = null where id = $1`, [id],
);

const retryNotification = (id, error) => query(
  `update public.schedule_notification_jobs
      set status = 'pending', last_error = $2,
          next_attempt_at = now() + (least(attempts, 6) * interval '1 minute')
    where id = $1`,
  [id, String(error).slice(0, 500)],
);

const listForDriver = async (driverId) => {
  const { rows } = await query(
    `select o.*, s.route_id, s.departure_stop_id, s.destination_stop_id,
            s.backup_matching_enabled, rte.name as route_name,
            p.full_name as passenger_name,
            ds.name as departure_stop_name, dst.name as destination_stop_name,
            b.id as bus_id, b.registration as bus_registration, b.total_seats,
            r.response as driver_response,
            greatest(b.total_seats - coalesce(cap.reserved_seats, 0), 0)::int as future_seats_remaining
       from public.buses b
       join public.commuter_schedules s on s.route_id = b.route_id
       join public.schedule_occurrences o on o.schedule_id = s.id
       join public.routes rte on rte.id = s.route_id
       join public.profiles p on p.id = o.passenger_id
       join public.bus_stops ds on ds.id = s.departure_stop_id
       join public.bus_stops dst on dst.id = s.destination_stop_id
       left join public.driver_schedule_responses r
         on r.occurrence_id = o.id and r.driver_id = $1
       left join lateral (
         select coalesce(sum(fr.seats), 0)::int as reserved_seats
           from public.future_reservations fr
           join public.schedule_occurrences ro on ro.id = fr.occurrence_id
          where fr.bus_id = b.id and fr.status = 'held'
            and tstzrange(ro.boarding_start_at, ro.boarding_end_at, '[)')
                && tstzrange(o.boarding_start_at, o.boarding_end_at, '[)')
      ) cap on true
      where b.driver_id = $1 and b.status <> 'deleted'
        and (
          (
            o.status in ('pending','offered')
            and o.assigned_driver_id is null
            and o.final_acceptance_deadline > now()
            and r.response is distinct from 'declined'
          )
          or
          (
            o.status in ('accepted','boarding_open','boarded')
            and o.assigned_driver_id = $1
            and o.boarding_end_at > now()
          )
        )
      order by o.boarding_start_at`,
    [driverId],
  );
  return rows;
};

const findForDriver = async (occurrenceId, driverId) => {
  const { rows } = await query(
    `select o.*, s.route_id, s.departure_stop_id, s.destination_stop_id,
            s.backup_matching_enabled, rte.name as route_name,
            p.full_name as passenger_name,
            ds.name as departure_stop_name, dst.name as destination_stop_name,
            coalesce(ab.id, eb.id) as bus_id,
            coalesce(ab.registration, eb.registration) as bus_registration,
            coalesce(ab.total_seats, eb.total_seats) as total_seats,
            resp.response as driver_response,
            greatest(coalesce(ab.total_seats, eb.total_seats, 0) - coalesce(cap.reserved_seats, 0), 0)::int
              as future_seats_remaining
       from public.schedule_occurrences o
       join public.commuter_schedules s on s.id = o.schedule_id
       join public.routes rte on rte.id = s.route_id
       join public.profiles p on p.id = o.passenger_id
       join public.bus_stops ds on ds.id = s.departure_stop_id
       join public.bus_stops dst on dst.id = s.destination_stop_id
       left join public.buses ab on ab.id = o.assigned_bus_id
       left join lateral (
         select b.id, b.registration, b.total_seats
           from public.buses b
          where b.driver_id = $2 and b.route_id = s.route_id and b.status <> 'deleted'
          order by b.created_at limit 1
       ) eb on true
       left join public.driver_schedule_responses resp
         on resp.occurrence_id = o.id and resp.driver_id = $2
       left join lateral (
         select coalesce(sum(fr.seats), 0)::int as reserved_seats
           from public.future_reservations fr
           join public.schedule_occurrences ro on ro.id = fr.occurrence_id
          where fr.bus_id = coalesce(o.assigned_bus_id, eb.id) and fr.status = 'held'
            and tstzrange(ro.boarding_start_at, ro.boarding_end_at, '[)')
                && tstzrange(o.boarding_start_at, o.boarding_end_at, '[)')
       ) cap on true
      where o.id = $1
        and (
          o.assigned_driver_id = $2
          or (
            o.status in ('pending','offered')
            and o.assigned_driver_id is null
            and o.final_acceptance_deadline > now()
            and eb.id is not null
            and resp.response is distinct from 'declined'
          )
        )`,
    [occurrenceId, driverId],
  );
  return rows[0] || null;
};

const listHistoryForDriver = async (driverId, limit = 50) => {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 50));
  const { rows } = await query(
    `select o.*, s.route_id, s.departure_stop_id, s.destination_stop_id,
            s.backup_matching_enabled, rte.name as route_name,
            p.full_name as passenger_name,
            ds.name as departure_stop_name, dst.name as destination_stop_name,
            b.id as bus_id, b.registration as bus_registration,
            resp.response as driver_response
       from public.schedule_occurrences o
       join public.commuter_schedules s on s.id = o.schedule_id
       join public.routes rte on rte.id = s.route_id
       join public.profiles p on p.id = o.passenger_id
       join public.bus_stops ds on ds.id = s.departure_stop_id
       join public.bus_stops dst on dst.id = s.destination_stop_id
       left join public.buses b on b.id = o.assigned_bus_id
       left join public.driver_schedule_responses resp
         on resp.occurrence_id = o.id and resp.driver_id = $1
      where o.status in ('unmatched','cancelled','expired','departed','completed')
        and (o.assigned_driver_id = $1 or resp.driver_id = $1)
      order by o.boarding_start_at desc
      limit $2`,
    [driverId, safeLimit],
  );
  return rows;
};

const acceptAtomic = async (occurrenceId, driverId) => withTransaction(async (client) => {
  const { rows: buses } = await client.query(
    `select * from public.buses
      where driver_id = $1 and status <> 'deleted'
      order by created_at limit 1 for update`,
    [driverId],
  );
  const bus = buses[0];
  if (!bus) return { error: 'NO_BUS' };

  const { rows: occurrences } = await client.query(
    `select o.*, s.route_id from public.schedule_occurrences o
      join public.commuter_schedules s on s.id = o.schedule_id
      where o.id = $1 for update of o`,
    [occurrenceId],
  );
  const occurrence = occurrences[0];
  if (!occurrence) return { error: 'NOT_FOUND' };
  if (occurrence.assigned_driver_id) {
    return occurrence.assigned_driver_id === driverId
      ? { occurrence, bus, alreadyAccepted: true }
      : { error: 'ALREADY_ASSIGNED' };
  }
  if (!['pending', 'offered'].includes(occurrence.status)) return { error: 'NOT_OPEN' };
  if (new Date(occurrence.final_acceptance_deadline) <= new Date()) return { error: 'DEADLINE_PASSED' };
  if (bus.route_id !== occurrence.route_id) return { error: 'WRONG_ROUTE' };

  const { rows: capacityRows } = await client.query(
    `select coalesce(sum(fr.seats), 0)::int as reserved
       from public.future_reservations fr
       join public.schedule_occurrences ro on ro.id = fr.occurrence_id
      where fr.bus_id = $1 and fr.status = 'held'
        and tstzrange(ro.boarding_start_at, ro.boarding_end_at, '[)')
            && tstzrange($2::timestamptz, $3::timestamptz, '[)')`,
    [bus.id, occurrence.boarding_start_at, occurrence.boarding_end_at],
  );
  const reserved = Number(capacityRows[0]?.reserved || 0);
  if (reserved >= bus.total_seats) return { error: 'FULL' };

  await client.query(
    `insert into public.driver_schedule_responses
      (occurrence_id, driver_id, bus_id, response)
     values ($1,$2,$3,'accepted')
     on conflict (occurrence_id, driver_id) do update
       set response = 'accepted', bus_id = excluded.bus_id, reason = null,
           responded_at = now(), updated_at = now()`,
    [occurrenceId, driverId, bus.id],
  );
  await client.query(
    `insert into public.future_reservations
      (occurrence_id, passenger_id, driver_id, bus_id, seats, status)
     values ($1,$2,$3,$4,1,'held')
     on conflict (occurrence_id) do update
       set passenger_id = excluded.passenger_id, driver_id = excluded.driver_id,
           bus_id = excluded.bus_id, seats = 1, status = 'held',
           held_at = now(), released_at = null, updated_at = now()`,
    [occurrenceId, occurrence.passenger_id, driverId, bus.id],
  );
  const { rows: accepted } = await client.query(
    `update public.schedule_occurrences
        set assigned_driver_id = $2, assigned_bus_id = $3, status = 'accepted',
            accepted_at = now(), updated_at = now()
      where id = $1 returning *`,
    [occurrenceId, driverId, bus.id],
  );
  await client.query(
    `update public.schedule_notification_jobs set status = 'cancelled'
      where occurrence_id = $1 and recipient_id <> $2
        and event_type in ('schedule_offer','schedule_reminder','schedule_reopened')
        and status = 'pending'`,
    [occurrenceId, driverId],
  );
  await client.query(
    `insert into public.schedule_notification_jobs
      (occurrence_id, recipient_id, event_type, payload)
     values ($1,$2,'schedule_accepted',$3::jsonb)
     on conflict (occurrence_id, recipient_id, event_type) do nothing`,
    [occurrenceId, occurrence.passenger_id, JSON.stringify({
      occurrenceId, serviceDate: occurrence.service_date, driverId,
      busId: bus.id, busRegistration: bus.registration,
      futureSeatsRemaining: bus.total_seats - reserved - 1,
    })],
  );
  return { occurrence: accepted[0], bus, futureSeatsRemaining: bus.total_seats - reserved - 1 };
});

const decline = async (occurrenceId, driverId, reason) => {
  const { rows } = await query(
    `insert into public.driver_schedule_responses
      (occurrence_id, driver_id, bus_id, response, reason)
     select o.id, $2, b.id, 'declined', $3
       from public.schedule_occurrences o
       join public.commuter_schedules s on s.id = o.schedule_id
       join public.buses b on b.route_id = s.route_id and b.driver_id = $2 and b.status <> 'deleted'
      where o.id = $1 and o.assigned_driver_id is null
        and o.status in ('pending','offered') and o.final_acceptance_deadline > now()
     on conflict (occurrence_id, driver_id) do update
       set response = 'declined', reason = excluded.reason, responded_at = now(), updated_at = now()
     returning *`,
    [occurrenceId, driverId, reason || null],
  );
  return rows[0] || null;
};

const withdrawAtomic = async (occurrenceId, driverId, reason) => withTransaction(async (client) => {
  const { rows } = await client.query(
    `select o.*, s.route_id from public.schedule_occurrences o
      join public.commuter_schedules s on s.id = o.schedule_id
      where o.id = $1 for update of o`,
    [occurrenceId],
  );
  const occurrence = rows[0];
  if (!occurrence) return { error: 'NOT_FOUND' };
  if (occurrence.assigned_driver_id !== driverId) return { error: 'NOT_ASSIGNED_DRIVER' };
  if (new Date(occurrence.boarding_opens_at) <= new Date()) return { error: 'BOARDING_OPEN' };

  await client.query(
    `update public.driver_schedule_responses
        set response = 'withdrawn', reason = $3, updated_at = now()
      where occurrence_id = $1 and driver_id = $2`,
    [occurrenceId, driverId, reason || null],
  );
  await client.query(
    `update public.future_reservations
        set status = 'released', released_at = now(), updated_at = now()
      where occurrence_id = $1 and status = 'held'`,
    [occurrenceId],
  );
  const { rows: reopened } = await client.query(
    `update public.schedule_occurrences
        set assigned_driver_id = null, assigned_bus_id = null, accepted_at = null,
            status = 'offered', updated_at = now()
      where id = $1 returning *`,
    [occurrenceId],
  );
  await client.query(
    `insert into public.schedule_notification_jobs
      (occurrence_id, recipient_id, event_type, payload)
     select o.id, b.driver_id, 'schedule_reopened',
            jsonb_build_object('occurrenceId', o.id, 'serviceDate', o.service_date,
              'boardingStartAt', o.boarding_start_at)
       from public.schedule_occurrences o
       join public.commuter_schedules s on s.id = o.schedule_id
       join public.buses b on b.route_id = s.route_id and b.driver_id is not null
       join public.drivers d on d.id = b.driver_id and d.status = 'active'
      where o.id = $1 and b.driver_id <> $2 and b.status <> 'deleted'
     on conflict (occurrence_id, recipient_id, event_type) do nothing`,
    [occurrenceId, driverId],
  );
  await client.query(
    `insert into public.schedule_notification_jobs
      (occurrence_id, recipient_id, event_type, payload)
     values ($1,$2,'schedule_driver_withdrawn',$3::jsonb)
     on conflict (occurrence_id, recipient_id, event_type) do nothing`,
    [occurrenceId, occurrence.passenger_id, JSON.stringify({ occurrenceId, serviceDate: occurrence.service_date })],
  );
  return { occurrence: reopened[0] };
});

module.exports = {
  listActiveSchedules, insert, queueInitialOffers, queueDueReminders,
  expireUnmatched, claimNotificationJobs, markNotificationSent, retryNotification,
  listForDriver, findForDriver, listHistoryForDriver, acceptAtomic, decline, withdrawAtomic,
};
