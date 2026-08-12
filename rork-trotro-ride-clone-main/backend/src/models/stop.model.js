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

module.exports = { list, findById, findActiveIds, insert, findNearby };
