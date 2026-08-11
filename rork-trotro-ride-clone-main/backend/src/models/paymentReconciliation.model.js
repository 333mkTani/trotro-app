const { query } = require('../config/db');

const record = async (data, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `insert into public.payment_reconciliation_events (
       provider, event_key, event_type, booking_id, payment_id,
       provider_reference, payload, outcome, error_message
     ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
     on conflict (provider, event_key) do nothing returning *`,
    [data.provider, data.eventKey, data.eventType, data.bookingId || null,
      data.paymentId || null, data.providerReference || null,
      JSON.stringify(data.payload || {}), data.outcome, data.errorMessage || null],
  );
  return rows[0] || null;
};

const listForBooking = async (bookingId) => {
  const { rows } = await query(
    `select * from public.payment_reconciliation_events
      where booking_id = $1 order by received_at asc`, [bookingId],
  );
  return rows;
};

module.exports = { record, listForBooking };
