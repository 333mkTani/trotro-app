const { query } = require('../config/db');

const COLUMNS = `id, booking_id, passenger_id, driver_id, rating, comment, created_at`;

const findByBookingId = async (bookingId) => {
  const { rows } = await query(
    `select ${COLUMNS} from public.driver_ratings where booking_id = $1`,
    [bookingId],
  );
  return rows[0] || null;
};

const listForDriver = async (driverId, { limit = 50 } = {}) => {
  const { rows } = await query(
    `select ${COLUMNS} from public.driver_ratings
      where driver_id = $1 order by created_at desc limit $2`,
    [driverId, limit],
  );
  return rows;
};

const insert = async ({ bookingId, passengerId, driverId, rating, comment }, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `insert into public.driver_ratings (booking_id, passenger_id, driver_id, rating, comment)
     values ($1,$2,$3,$4,$5)
     returning ${COLUMNS}`,
    [bookingId, passengerId, driverId, rating, comment || null],
  );
  return rows[0];
};

module.exports = { findByBookingId, listForDriver, insert };
