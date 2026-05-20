const { query } = require('../config/db');

const COLUMNS = `id, full_name, phone, license_number, rating_avg, rating_count, status, created_at`;

const list = async ({ status = 'active' } = {}) => {
  const { rows } = await query(
    `select ${COLUMNS} from public.drivers where status = $1 order by full_name asc`,
    [status],
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await query(`select ${COLUMNS} from public.drivers where id = $1`, [id]);
  return rows[0] || null;
};

const insert = async ({ id, fullName, phone, licenseNumber }) => {
  const { rows } = await query(
    `insert into public.drivers (id, full_name, phone, license_number)
     values ($1,$2,$3,$4) returning ${COLUMNS}`,
    [id, fullName, phone, licenseNumber || null],
  );
  return rows[0];
};

const recomputeRating = async (driverId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `with agg as (
       select coalesce(avg(rating)::numeric(3,2), 0) as avg_rating, count(*)::int as cnt
       from public.driver_ratings where driver_id = $1
     )
     update public.drivers d
        set rating_avg = agg.avg_rating, rating_count = agg.cnt
       from agg
      where d.id = $1
      returning ${COLUMNS}`,
    [driverId],
  );
  return rows[0] || null;
};

module.exports = { list, findById, insert, recomputeRating };
