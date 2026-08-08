const { query } = require('../config/db');

const runner = (client) => client || { query };

const openDue = async (now, client) => {
  const { rows } = await runner(client).query(
    `update public.schedule_occurrences
        set status = 'boarding_open', updated_at = now()
      where status = 'accepted' and assigned_driver_id is not null
        and boarding_opens_at <= $1 and boarding_end_at > $1
      returning *`, [now],
  );
  return rows;
};

const insertCode = async (occurrence, code, qrPayload, client) => {
  const { rows } = await runner(client).query(
    `insert into public.schedule_boarding_codes
      (occurrence_id, code, qr_payload, valid_from, valid_until)
     values ($1,$2,$3,$4,$5)
     on conflict (occurrence_id) do update set updated_at = now()
     returning *`,
    [occurrence.id, code, qrPayload, occurrence.boarding_opens_at, occurrence.boarding_end_at],
  );
  return rows[0];
};

const findPassengerCode = async (occurrenceId, passengerId) => {
  const { rows } = await query(
    `select c.*, o.status as occurrence_status, o.boarding_start_at, o.boarding_end_at
       from public.schedule_boarding_codes c
       join public.schedule_occurrences o on o.id = c.occurrence_id
      where c.occurrence_id = $1 and o.passenger_id = $2`, [occurrenceId, passengerId],
  );
  return rows[0] || null;
};

const lockByCode = async (code, client) => {
  const { rows } = await client.query(
    `select c.*, o.passenger_id, o.assigned_driver_id, o.assigned_bus_id,
            o.status as occurrence_status, o.boarding_start_at, o.boarding_end_at,
            s.route_id, s.departure_stop_id, s.destination_stop_id,
            ds.name as departure_stop_name, dst.name as destination_stop_name,
            r.name as route_name, r.fare as route_fare
       from public.schedule_boarding_codes c
       join public.schedule_occurrences o on o.id = c.occurrence_id
       join public.commuter_schedules s on s.id = o.schedule_id
       join public.bus_stops ds on ds.id = s.departure_stop_id
       join public.bus_stops dst on dst.id = s.destination_stop_id
       join public.routes r on r.id = s.route_id
      where c.code = $1 for update of c, o`, [code],
  );
  return rows[0] || null;
};

const markBoarded = async (record, bookingId, client) => {
  const { rows } = await client.query(
    `update public.schedule_occurrences
        set status = 'boarded', boarded_at = coalesce(boarded_at, now()), updated_at = now()
      where id = $1 and status = 'boarding_open' returning *`, [record.occurrence_id],
  );
  if (!rows[0]) return null;
  await client.query(
    `update public.future_reservations set status = 'boarded', updated_at = now()
      where occurrence_id = $1 and status = 'held'`, [record.occurrence_id],
  );
  await client.query(
    `update public.schedule_boarding_codes
        set status = 'used', used_at = coalesce(used_at, now()), booking_id = $2, updated_at = now()
      where id = $1 and status = 'active'`, [record.id, bookingId],
  );
  return rows[0];
};

const cancel = async (occurrenceId, passengerId, now, client) => {
  const { rows } = await client.query(
    `update public.schedule_occurrences
        set status = 'cancelled', cancelled_at = coalesce(cancelled_at, $3), updated_at = now()
      where id = $1 and passenger_id = $2
        and status in ('pending','offered','accepted') and boarding_opens_at > $3
      returning *`, [occurrenceId, passengerId, now],
  );
  if (!rows[0]) {
    const { rows: terminal } = await client.query(`select * from public.schedule_occurrences where id = $1 and passenger_id = $2 and status = 'cancelled'`, [occurrenceId, passengerId]);
    return terminal[0] || null;
  }
  await client.query(
    `update public.future_reservations
        set status = 'cancelled', released_at = coalesce(released_at, $2), updated_at = now()
      where occurrence_id = $1 and status = 'held'`, [occurrenceId, now],
  );
  await client.query(
    `update public.schedule_boarding_codes set status = 'cancelled', updated_at = now()
      where occurrence_id = $1 and status = 'active'`, [occurrenceId],
  );
  return rows[0];
};

const expireNoShows = async (now, client) => {
  const { rows } = await client.query(
    `update public.schedule_occurrences
        set status = 'expired', expired_at = coalesce(expired_at, $1), updated_at = now()
      where status in ('accepted','boarding_open') and boarded_at is null and boarding_end_at <= $1
      returning *`, [now],
  );
  for (const occurrence of rows) {
    await client.query(
      `update public.future_reservations set status = 'expired', released_at = coalesce(released_at, $2), updated_at = now()
        where occurrence_id = $1 and status = 'held'`, [occurrence.id, now],
    );
    await client.query(
      `update public.schedule_boarding_codes set status = 'expired', updated_at = now()
        where occurrence_id = $1 and status = 'active'`, [occurrence.id],
    );
    await client.query(
      `insert into public.schedule_no_shows (occurrence_id, passenger_id) values ($1,$2)
       on conflict (occurrence_id) do nothing`, [occurrence.id, occurrence.passenger_id],
    );
  }
  return rows;
};

const depart = async (occurrenceId, driverId, now, client) => {
  const { rows } = await client.query(
    `update public.schedule_occurrences
        set status = case when status = 'boarded' then 'departed' else 'expired' end,
            departed_at = case when status = 'boarded' then $3 else departed_at end,
            expired_at = case when status = 'boarding_open' then $3 else expired_at end,
            updated_at = now()
      where id = $1 and assigned_driver_id = $2 and status in ('boarding_open','boarded')
      returning *`, [occurrenceId, driverId, now],
  );
  if (!rows[0]) {
    const { rows: terminal } = await client.query(`select * from public.schedule_occurrences where id = $1 and assigned_driver_id = $2 and status in ('departed','expired')`, [occurrenceId, driverId]);
    return terminal[0] || null;
  }
  if (rows[0].status === 'expired') {
    await client.query(`update public.future_reservations set status = 'expired', released_at = coalesce(released_at, $2), updated_at = now() where occurrence_id = $1 and status = 'held'`, [occurrenceId, now]);
    await client.query(`update public.schedule_boarding_codes set status = 'expired', updated_at = now() where occurrence_id = $1 and status = 'active'`, [occurrenceId]);
    await client.query(`insert into public.schedule_no_shows (occurrence_id, passenger_id) values ($1,$2) on conflict (occurrence_id) do nothing`, [occurrenceId, rows[0].passenger_id]);
  }
  return rows[0];
};

const markCompleted = (occurrenceId, client) => runner(client).query(
  `update public.schedule_occurrences set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
    where id = $1 and status = 'departed' returning *`, [occurrenceId],
);

module.exports = { openDue, insertCode, findPassengerCode, lockByCode, markBoarded,
  cancel, expireNoShows, depart, markCompleted };
