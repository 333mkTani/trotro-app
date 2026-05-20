const { query } = require('../config/db');

const COLUMNS = `id, name, origin, destination, distance_km, duration_min, fare, status, created_at`;

const list = async ({ status = 'active' } = {}) => {
  const { rows } = await query(
    `select ${COLUMNS} from public.routes where status = $1 order by name asc`,
    [status],
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await query(`select ${COLUMNS} from public.routes where id = $1`, [id]);
  return rows[0] || null;
};

const findStops = async (routeId) => {
  const { rows } = await query(
    `select rs.sequence, s.id, s.name, s.type, s.lat, s.lng, s.status
       from public.route_stops rs
       join public.bus_stops s on s.id = rs.stop_id
      where rs.route_id = $1
      order by rs.sequence asc`,
    [routeId],
  );
  return rows;
};

const insert = async ({ name, origin, destination, distanceKm, durationMin, fare }) => {
  const { rows } = await query(
    `insert into public.routes (name, origin, destination, distance_km, duration_min, fare)
     values ($1,$2,$3,$4,$5,$6) returning ${COLUMNS}`,
    [name, origin, destination, distanceKm, durationMin, fare],
  );
  return rows[0];
};

module.exports = { list, findById, findStops, insert };
