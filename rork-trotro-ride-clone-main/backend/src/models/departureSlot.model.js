const { query } = require('../config/db');

const COLUMNS = `id, driver_id, bus_id, route_id, departure_stop_id, destination_stop_id,
  travel_days, boarding_start_local, boarding_end_local, timezone, status, created_at, updated_at`;

const listForDriver = async (driverId) => (await query(
  `select ${COLUMNS} from public.driver_departure_slots
    where driver_id = $1 and status <> 'deleted' order by boarding_start_local`, [driverId],
)).rows;

const listPublished = async ({ routeId, departureStopId, destinationStopId }) => (await query(
  `select s.*, d.full_name as driver_name, b.registration as bus_registration,
          b.total_seats, b.total_seats::int as future_seats_remaining
     from public.driver_departure_slots s
     join public.drivers d on d.id = s.driver_id
     join public.buses b on b.id = s.bus_id and b.driver_id = s.driver_id
    where s.route_id = $1 and s.departure_stop_id = $2 and s.destination_stop_id = $3
      and s.status = 'active' and b.status <> 'deleted'
    order by s.boarding_start_local, d.full_name`,
  [routeId, departureStopId, destinationStopId],
)).rows;

const findActiveById = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select ${COLUMNS} from public.driver_departure_slots where id = $1 and status = 'active'`, [id],
  );
  return rows[0] || null;
};

const insert = async (driverId, busId, data) => (await query(
  `insert into public.driver_departure_slots
    (driver_id,bus_id,route_id,departure_stop_id,destination_stop_id,travel_days,
     boarding_start_local,boarding_end_local,timezone)
   values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning ${COLUMNS}`,
  [driverId, busId, data.routeId, data.departureStopId, data.destinationStopId,
    data.travelDays, data.boardingStartLocal, data.boardingEndLocal, data.timezone],
)).rows[0];

const routeContainsStops = async (routeId, departureStopId, destinationStopId) => {
  const { rows } = await query(
    `select count(distinct stop_id)::int as matched
       from public.route_stops where route_id = $1 and stop_id = any($2::uuid[])`,
    [routeId, [departureStopId, destinationStopId]],
  );
  return rows[0]?.matched === 2;
};

const remove = async (id, driverId) => (await query(
  `update public.driver_departure_slots set status = 'deleted', updated_at = now()
    where id = $1 and driver_id = $2 and status <> 'deleted' returning ${COLUMNS}`,
  [id, driverId],
)).rows[0] || null;

module.exports = { listForDriver, listPublished, findActiveById, routeContainsStops, insert, remove };
