const { query } = require('../config/db');

const COLUMNS = `id, registration, driver_id, route_id, total_seats, seats_available,
  current_lat, current_lng, last_ping_at, status, driving_status, created_at`;

// Only surfaces buses a passenger could actually board: `seats_available > 0`
// is enforced here so full buses never appear in discovery, matching
// listActive/listApproachingStop. An admin "all buses" view should query with
// its own explicit flag rather than reusing this.
const list = async ({ routeId, status = 'active' } = {}) => {
  if (routeId) {
    const { rows } = await query(
      `select ${COLUMNS} from public.buses
        where status = $1 and route_id = $2 and seats_available > 0`,
      [status, routeId],
    );
    return rows;
  }
  const { rows } = await query(
    `select ${COLUMNS} from public.buses where status = $1 and seats_available > 0`,
    [status],
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await query(`select ${COLUMNS} from public.buses where id = $1`, [id]);
  return rows[0] || null;
};

const insert = async ({ registration, driverId, routeId, totalSeats = 14 }) => {
  const { rows } = await query(
    `insert into public.buses (registration, driver_id, route_id, total_seats, seats_available)
     values ($1,$2,$3,$4,$4) returning ${COLUMNS}`,
    [registration, driverId || null, routeId || null, totalSeats],
  );
  return rows[0];
};

const updateLocation = async (id, { lat, lng }) => {
  const { rows } = await query(
    `update public.buses
        set current_lat = $1, current_lng = $2, last_ping_at = now()
      where id = $3
      returning ${COLUMNS}`,
    [lat, lng, id],
  );
  return rows[0] || null;
};

const adjustSeats = async (id, delta, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.buses
        set seats_available = greatest(0, seats_available + $1)
      where id = $2
      returning ${COLUMNS}`,
    [delta, id],
  );
  return rows[0] || null;
};

/**
 * Atomically reserve one seat. The `seats_available > 0` guard is evaluated
 * under the row lock the UPDATE takes, so concurrent bookings serialise and
 * can never oversell. Returns the updated bus, or null when the bus is full
 * (no row matched) — callers treat null as "no seats available".
 */
const reserveSeat = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.buses
        set seats_available = seats_available - 1
      where id = $1 and seats_available > 0
      returning ${COLUMNS}`,
    [id],
  );
  return rows[0] || null;
};

/** Reserve a seat only when the bus is eligible for automatic acceptance. */
const reserveSeatForAutoAccept = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.buses
        set seats_available = seats_available - 1
      where id = $1
        and status = 'active'
        and driving_status = 'EN_ROUTE'
        and seats_available > 0
      returning ${COLUMNS}`,
    [id],
  );
  return rows[0] || null;
};

/**
 * Active buses with at least one free seat within `radiusM` metres of a
 * coordinate, optionally filtered by `routeId`. Ordered by distance via
 * PostGIS KNN. Full buses are excluded so discovery never offers a bus a
 * passenger can't board.
 */
const findNearby = async ({ lat, lng, radiusM = 2000, routeId, limit = 50 }) => {
  const params = [lng, lat, radiusM, limit];
  let routeFilter = '';
  if (routeId) {
    params.push(routeId);
    routeFilter = `and route_id = ${params.length}`;
  }
  const { rows } = await query(
    `select ${COLUMNS},
            ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_m
      from public.buses
      where status = 'active'
        and driver_id is not null
        and last_ping_at > now() - interval '10 minutes'
        and seats_available > 0
        and geom is not null
        ${routeFilter}
        and ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      order by geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      limit $4`,
    params,
  );
  return rows;
};

const listActive = async () => {
  const { rows } = await query(
    `SELECT b.driver_id, b.registration AS bus_registration, b.route_id,
            b.seats_available, b.total_seats, b.current_lat, b.current_lng,
            r.name AS route_name,
            d.full_name AS driver_name
     FROM public.buses b
     LEFT JOIN public.routes r ON r.id = b.route_id
     LEFT JOIN public.drivers d ON d.id = b.driver_id
     WHERE b.status = 'active'
       AND b.driver_id IS NOT NULL
       AND b.last_ping_at > now() - interval '10 minutes'
       AND b.seats_available > 0`,
  );
  return rows;
};

const findByDriverId = async (driverId) => {
  const { rows } = await query(
    `select ${COLUMNS} from public.buses where driver_id = $1 and status in ('active', 'paused') limit 1`,
    [driverId],
  );
  return rows[0] || null;
};

/**
 * Active buses approaching a specific stop, optionally filtered by route
 * name, ordered nearest-first via PostGIS KNN. One row per bus (driver_id
 * is unique here since a driver can only run one active bus at a time).
 */
const listApproachingStop = async ({ stopId, routeName, radiusM = 3000, limit = 50 }) => {
  const params = [stopId, radiusM, limit];
  let routeFilter = '';
  if (routeName) {
    params.push(routeName);
    routeFilter = `and r.name = $${params.length}`;
  }
  const { rows } = await query(
    `select b.driver_id, b.registration as bus_registration, b.route_id,
            b.seats_available, b.total_seats, b.current_lat, b.current_lng,
            r.name as route_name, d.full_name as driver_name,
            ST_Distance(b.geom, s.geom) as distance_m
       from public.buses b
       join public.bus_stops s on s.id = $1
       left join public.routes r on r.id = b.route_id
       left join public.drivers d on d.id = b.driver_id
      where b.status = 'active'
        and b.driver_id is not null
        and b.last_ping_at > now() - interval '10 minutes'
        and b.seats_available > 0
        and b.geom is not null
        and s.geom is not null
        ${routeFilter}
        and ST_DWithin(b.geom, s.geom, $2)
      order by b.geom <-> s.geom
      limit $3`,
    params,
  );
  return rows;
};

module.exports = {
  list, findById, insert, updateLocation, adjustSeats, reserveSeat, reserveSeatForAutoAccept, findNearby, listActive,
  findByDriverId, listApproachingStop,
};
