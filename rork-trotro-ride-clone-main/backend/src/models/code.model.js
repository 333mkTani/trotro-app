const { query } = require('../config/db');

const COLUMNS = `id, booking_id, code, qr_payload, status, valid_until, used_at, invalidated_at, created_at`;

const findByBookingId = async (bookingId) => {
  const { rows } = await query(
    `select ${COLUMNS} from public.verification_codes where booking_id = $1`,
    [bookingId],
  );
  return rows[0] || null;
};

const findByCode = async (code) => {
  const { rows } = await query(
    `select ${COLUMNS} from public.verification_codes where code = $1`,
    [code],
  );
  return rows[0] || null;
};

const insert = async ({ bookingId, code, qrPayload, validUntil }, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `insert into public.verification_codes (booking_id, code, qr_payload, valid_until)
     values ($1,$2,$3,$4)
     returning ${COLUMNS}`,
    [bookingId, code, qrPayload, validUntil],
  );
  return rows[0];
};

const markUsed = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.verification_codes
        set status = 'used', used_at = now()
      where id = $1 and status = 'valid'
      returning ${COLUMNS}`,
    [id],
  );
  return rows[0] || null;
};

const invalidate = async (id) => {
  const { rows } = await query(
    `update public.verification_codes
        set status = 'invalidated', invalidated_at = now()
      where id = $1
      returning ${COLUMNS}`,
    [id],
  );
  return rows[0] || null;
};

module.exports = { findByBookingId, findByCode, insert, markUsed, invalidate };
