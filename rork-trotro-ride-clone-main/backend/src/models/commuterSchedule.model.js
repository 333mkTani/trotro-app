const { query } = require('../config/db');

const COLUMNS = `id, passenger_id, route_id, departure_stop_id, destination_stop_id,
  departure_slot_id, travel_days, boarding_start_local, boarding_end_local, timezone,
  primary_deadline_local, backup_matching_enabled, status, created_at, updated_at`;

const listForPassenger = async (passengerId) => {
  const { rows } = await query(
    `select ${COLUMNS} from public.commuter_schedules
      where passenger_id = $1 and status <> 'deleted'
      order by created_at desc`,
    [passengerId],
  );
  return rows;
};

const findById = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select ${COLUMNS} from public.commuter_schedules where id = $1`,
    [id],
  );
  return rows[0] || null;
};

const insert = async (passengerId, data) => {
  const { rows } = await query(
    `insert into public.commuter_schedules
      (passenger_id, route_id, departure_stop_id, destination_stop_id,
       departure_slot_id, travel_days, boarding_start_local, boarding_end_local, timezone,
       primary_deadline_local, backup_matching_enabled)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     returning ${COLUMNS}`,
    [
      passengerId, data.routeId, data.departureStopId, data.destinationStopId,
      data.departureSlotId, data.travelDays, data.boardingStartLocal, data.boardingEndLocal,
      data.timezone, data.primaryDeadlineLocal, data.backupMatchingEnabled,
    ],
  );
  return rows[0];
};

const update = async (id, patch) => {
  const fields = [];
  const values = [];
  const map = {
    routeId: 'route_id', departureStopId: 'departure_stop_id',
    destinationStopId: 'destination_stop_id', departureSlotId: 'departure_slot_id', travelDays: 'travel_days',
    boardingStartLocal: 'boarding_start_local', boardingEndLocal: 'boarding_end_local',
    timezone: 'timezone', primaryDeadlineLocal: 'primary_deadline_local',
    backupMatchingEnabled: 'backup_matching_enabled', status: 'status',
  };
  let i = 1;
  for (const [key, column] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      fields.push(`${column} = $${i++}`);
      values.push(patch[key]);
    }
  }
  if (!fields.length) return findById(id);
  fields.push('updated_at = now()');
  values.push(id);
  const { rows } = await query(
    `update public.commuter_schedules set ${fields.join(', ')}
      where id = $${i} returning ${COLUMNS}`,
    values,
  );
  return rows[0] || null;
};

const listOccurrences = async (scheduleId, passengerId) => {
  const { rows } = await query(
    `select o.*, c.code as boarding_code, c.qr_payload as boarding_qr_payload,
            c.valid_from as code_valid_from, c.valid_until as code_valid_until,
            c.status as code_status from public.schedule_occurrences o
      join public.commuter_schedules s on s.id = o.schedule_id
      left join public.schedule_boarding_codes c on c.occurrence_id = o.id
      where o.schedule_id = $1 and s.passenger_id = $2
      order by o.service_date desc`,
    [scheduleId, passengerId],
  );
  return rows;
};

const listAllOccurrencesForPassenger = async (passengerId) => {
  const { rows } = await query(
    `select o.*, s.route_id, s.departure_stop_id, s.destination_stop_id,
            rte.name as route_name, ds.name as departure_stop_name,
            dst.name as destination_stop_name,
            c.code as boarding_code, c.qr_payload as boarding_qr_payload,
            c.valid_from as code_valid_from, c.valid_until as code_valid_until,
            c.status as code_status
       from public.schedule_occurrences o
       join public.commuter_schedules s on s.id = o.schedule_id
       join public.routes rte on rte.id = s.route_id
       join public.bus_stops ds on ds.id = s.departure_stop_id
       join public.bus_stops dst on dst.id = s.destination_stop_id
       left join public.schedule_boarding_codes c on c.occurrence_id = o.id
      where o.passenger_id = $1
      order by o.boarding_start_at asc`,
    [passengerId],
  );
  return rows;
};

const removeAndCancelFuture = async (scheduleId, passengerId, now, client) => {
  const { rows: schedules } = await client.query(
    `update public.commuter_schedules
        set status = 'deleted', updated_at = now()
      where id = $1 and passenger_id = $2 and status <> 'deleted'
      returning ${COLUMNS}`,
    [scheduleId, passengerId],
  );
  if (!schedules[0]) return null;

  const { rows: occurrences } = await client.query(
    `update public.schedule_occurrences
        set status = 'cancelled', cancelled_at = coalesce(cancelled_at, $3), updated_at = now()
      where schedule_id = $1 and passenger_id = $2
        and status in ('pending','offered','accepted')
        and boarding_opens_at > $3
      returning *`,
    [scheduleId, passengerId, now],
  );

  if (occurrences.length) {
    const ids = occurrences.map((occurrence) => occurrence.id);
    await client.query(
      `update public.future_reservations
          set status = 'cancelled', released_at = coalesce(released_at, $2), updated_at = now()
        where occurrence_id = any($1::uuid[]) and status = 'held'`,
      [ids, now],
    );
    await client.query(
      `update public.schedule_boarding_codes set status = 'cancelled', updated_at = now()
        where occurrence_id = any($1::uuid[]) and status = 'active'`,
      [ids],
    );
  }

  return { schedule: schedules[0], occurrences };
};

module.exports = { listForPassenger, findById, insert, update, listOccurrences,
  listAllOccurrencesForPassenger, removeAndCancelFuture };
