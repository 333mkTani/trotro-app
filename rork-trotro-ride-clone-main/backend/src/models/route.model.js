const { query, withTransaction } = require('../config/db');

const COLUMNS = `id, name, origin, destination, distance_km, duration_min, fare, city, status, created_at`;

/** `status: 'all'` skips the status filter (admin listings only). */
const list = async ({ status = 'active', city = null } = {}) => {
  const params = [];
  const statusClause = status === 'all' ? '' : `AND r.status = $${params.push(status)}`;
  const cityClause = city ? `AND r.city = $${params.push(city)}` : '';
  const { rows } = await query(
    `SELECT r.id, r.name, r.origin, r.destination, r.distance_km, r.duration_min, r.fare,
            r.city, r.status, r.created_at,
            COALESCE(
              array_agg(s.id::text ORDER BY rs.sequence ASC)  FILTER (WHERE s.id IS NOT NULL),
              ARRAY[]::text[]
            ) AS stops_sequence,
            COALESCE(
              array_agg(s.id::text ORDER BY rs.sequence DESC) FILTER (WHERE s.id IS NOT NULL),
              ARRAY[]::text[]
            ) AS reverse_stops_sequence
     FROM public.routes r
     LEFT JOIN public.route_stops rs ON rs.route_id = r.id
     LEFT JOIN public.bus_stops s ON s.id = rs.stop_id AND s.status = 'active'
     WHERE true ${statusClause} ${cityClause}
     GROUP BY r.id
     ORDER BY r.name ASC`,
    params,
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
        and s.status = 'active'
      order by rs.sequence asc`,
    [routeId],
  );
  return rows;
};

/**
 * Replace a route's stop list with `stopIds`, in the order given.
 *
 * route_stops is keyed on (route_id, sequence) and also unique on
 * (route_id, stop_id), so editing positions row by row deadlocks against one
 * constraint or the other. Clearing the route inside a transaction and
 * re-inserting the whole ordered list avoids both, and makes the write
 * idempotent. Nothing reads `sequence` for anything but ordering, but the
 * seeded routes number from 0, so `ordinality` (1-based) is shifted to match.
 */
const replaceStops = async (routeId, stopIds) => {
  await withTransaction(async (client) => {
    await client.query('delete from public.route_stops where route_id = $1', [routeId]);
    if (stopIds.length === 0) return;
    await client.query(
      `insert into public.route_stops (route_id, stop_id, sequence)
       select $1, t.id, t.ord - 1
         from unnest($2::uuid[]) with ordinality as t(id, ord)`,
      [routeId, stopIds],
    );
  });
  return findStops(routeId);
};

const insert = async ({ name, origin, destination, distanceKm, durationMin, fare, city }) => {
  const { rows } = await query(
    `insert into public.routes (name, origin, destination, distance_km, duration_min, fare, city)
     values ($1,$2,$3,$4,$5,$6, coalesce($7, 'accra')) returning ${COLUMNS}`,
    [name, origin, destination, distanceKm ?? null, durationMin ?? null, fare, city ?? null],
  );
  return rows[0];
};

const FIELD_COLUMNS = {
  name: 'name',
  origin: 'origin',
  destination: 'destination',
  distanceKm: 'distance_km',
  durationMin: 'duration_min',
  fare: 'fare',
  city: 'city',
  status: 'status',
};

/** Partial update. `fields` uses camelCase keys from UpdateRouteSchema. */
const update = async (id, fields = {}) => {
  const params = [id];
  const assignments = Object.entries(fields)
    .filter(([key]) => FIELD_COLUMNS[key])
    .map(([key, value]) => `${FIELD_COLUMNS[key]} = $${params.push(value)}`);
  if (assignments.length === 0) return findById(id);
  const { rows } = await query(
    `update public.routes set ${assignments.join(', ')} where id = $1 returning ${COLUMNS}`,
    params,
  );
  return rows[0] || null;
};

/**
 * Soft delete. Routes are referenced by buses.route_id and bookings.route_id,
 * so rows are never removed — the status flag takes them out of circulation.
 * Idempotent: archiving an already-deleted route returns the same row.
 */
const archive = async (id) => {
  const { rows } = await query(
    `update public.routes set status = 'deleted' where id = $1 returning ${COLUMNS}`,
    [id],
  );
  return rows[0] || null;
};

/** What still points at this route — surfaced before an admin archives it. */
const countDependencies = async (id) => {
  const { rows } = await query(
    `select
       (select count(*)::int from public.buses    b where b.route_id = $1 and b.status = 'active') as active_buses,
       (select count(*)::int from public.bookings k where k.route_id = $1
          and k.status in ('pending', 'confirmed'))                                                as open_bookings`,
    [id],
  );
  return rows[0] || { active_buses: 0, open_bookings: 0 };
};

module.exports = {
  list, findById, findStops, replaceStops, insert, update, archive, countDependencies,
};
