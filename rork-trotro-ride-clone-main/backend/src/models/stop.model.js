const { query } = require('../config/db');

const COLUMNS = `id, name, type, lat, lng, status, created_at`;

const list = async ({ status = 'active' } = {}) => {
  const { rows } = await query(
    `select ${COLUMNS} from public.bus_stops where status = $1 order by name asc`,
    [status],
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await query(`select ${COLUMNS} from public.bus_stops where id = $1`, [id]);
  return rows[0] || null;
};

/**
 * Which of `ids` name a stop that exists and is still active. Callers use the
 * difference to reject bad input with a 400 rather than letting the
 * route_stops foreign key raise a 500.
 */
const findActiveIds = async (ids) => {
  if (ids.length === 0) return [];
  const { rows } = await query(
    `select id::text as id from public.bus_stops
      where status = 'active' and id = any($1::uuid[])`,
    [ids],
  );
  return rows.map((row) => row.id);
};

const insert = async ({ name, type = 'stop', lat, lng }) => {
  const { rows } = await query(
    `insert into public.bus_stops (name, type, lat, lng)
     values ($1,$2,$3,$4) returning ${COLUMNS}`,
    [name, type, lat, lng],
  );
  return rows[0];
};

const activeReferences = async (id) => {
  const { rows } = await query(
    `select
       (select count(*)::int from public.route_stops rs join public.routes r on r.id = rs.route_id
         where rs.stop_id = $1 and r.status <> 'deleted') as routes,
       (select count(*)::int from public.commuter_schedules s where s.status <> 'deleted'
         and (s.departure_stop_id = $1 or s.destination_stop_id = $1)) as schedules,
       (select count(*)::int from public.driver_departure_slots ds where ds.status <> 'deleted'
         and (ds.departure_stop_id = $1 or ds.destination_stop_id = $1)) as departure_slots,
       (select count(*)::int from public.bus_alerts a
         where a.is_active = true and a.stop_id = $1) as alerts`,
    [id],
  );
  return rows[0];
};

const archive = async (id) => {
  const { rows } = await query(
    `update public.bus_stops set status = 'deleted'
      where id = $1 and status <> 'deleted' returning ${COLUMNS}`,
    [id],
  );
  return rows[0] || null;
};

/**
 * Find stops within `radiusM` metres of (lat, lng), ordered by distance
 * using PostGIS KNN. Returns each stop with `distance_m`.
 */
const findNearby = async ({ lat, lng, radiusM = 1000, limit = 25 }) => {
  const { rows } = await query(
    `select ${COLUMNS},
            ST_Distance(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_m
       from public.bus_stops
      where status = 'active'
        and geom is not null
        and ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)
      order by geom <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
      limit $4`,
    [lng, lat, radiusM, limit],
  );
  return rows;
};

module.exports = { list, findById, findActiveIds, insert, activeReferences, archive, findNearby };
