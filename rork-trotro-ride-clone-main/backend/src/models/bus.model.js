const { query } = require('../config/db');

const COLUMNS = `id, registration, driver_id, route_id, total_seats, seats_available,
  current_lat, current_lng, last_ping_at, status, created_at`;

const list = async ({ routeId, status = 'active' } = {}) => {
  if (routeId) {
    const { rows } = await query(
      `select ${COLUMNS} from public.buses where status = $1 and route_id = $2`,
      [status, routeId],
    );
    return rows;
  }
  const { rows } = await query(`select ${COLUMNS} from public.buses where status = $1`, [status]);
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
 * Active buses within `radiusM` metres of a coordinate, optionally filtered
 * by `routeId`. Ordered by distance via PostGIS KNN.
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
     WHERE b.status = 'active' AND b.seats_available > 0`,
  );
  return rows;
};

module.exports = { list, findById, insert, updateLocation, adjustSeats, findNearby, listActive };
