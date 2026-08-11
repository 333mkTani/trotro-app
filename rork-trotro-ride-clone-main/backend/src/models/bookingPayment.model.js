const { query } = require('../config/db');

const insert = async (data, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `insert into public.booking_payments (
       booking_id, occurrence_id, passenger_id, driver_id, type, amount,
       currency, status, provider, provider_reference, idempotency_key, metadata,
       parent_payment_id
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
     returning *`,
    [
      data.bookingId || null, data.occurrenceId || null, data.passengerId,
      data.driverId || null, data.type, data.amount, data.currency || 'GHS',
      data.status || 'initiated', data.provider || null,
      data.providerReference || null, data.idempotencyKey,
      JSON.stringify(data.metadata || {}),
      data.parentPaymentId || null,
    ],
  );
  return rows[0];
};

const findSucceededDepositForBookingForUpdate = async (bookingId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select * from public.booking_payments
      where booking_id = $1 and type = 'deposit' and status = 'succeeded'
      order by confirmed_at desc limit 1 for update`, [bookingId],
  );
  return rows[0] || null;
};

const findActiveRefundForParentForUpdate = async (parentPaymentId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select * from public.booking_payments
      where parent_payment_id = $1 and type = 'refund'
        and status in ('initiated','pending','succeeded')
      order by created_at desc limit 1 for update`, [parentPaymentId],
  );
  return rows[0] || null;
};

const findRefundByOriginalReferenceForUpdate = async (reference, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select refund.* from public.booking_payments refund
       join public.booking_payments original on original.id = refund.parent_payment_id
      where refund.type = 'refund' and original.provider_reference = $1
      order by refund.created_at desc limit 1 for update`, [reference],
  );
  return rows[0] || null;
};

const markRefundPending = async (id, providerEventId, metadata, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.booking_payments set status = 'pending', provider_event_id = $2,
       metadata = metadata || $3::jsonb, updated_at = now()
     where id = $1 and status = 'initiated' returning *`,
    [id, providerEventId || null, JSON.stringify(metadata || {})],
  );
  return rows[0] || null;
};

const attachRefundProvider = async (id, providerEventId, metadata, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.booking_payments
        set provider_event_id = coalesce(provider_event_id, $2),
            metadata = metadata || $3::jsonb, updated_at = now()
      where id = $1 and status = 'pending' returning *`,
    [id, providerEventId, JSON.stringify(metadata || {})],
  );
  return rows[0] || null;
};

const findByIdempotencyKeyForUpdate = async (idempotencyKey, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select * from public.booking_payments where idempotency_key = $1 for update`,
    [idempotencyKey],
  );
  return rows[0] || null;
};

const findByIdForUpdate = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select * from public.booking_payments where id = $1 for update`, [id],
  );
  return rows[0] || null;
};

const listForBooking = async (bookingId) => {
  const { rows } = await query(
    `select * from public.booking_payments where booking_id = $1 order by created_at asc`,
    [bookingId],
  );
  return rows;
};

const listPendingRefunds = async (limit = 50) => {
  const { rows } = await query(
    `select refund.*, original.provider_reference as original_provider_reference
       from public.booking_payments refund
       join public.booking_payments original on original.id = refund.parent_payment_id
      where refund.type = 'refund' and refund.status = 'pending'
        and refund.provider_event_id is not null
      order by refund.updated_at asc limit $1`, [limit],
  );
  return rows;
};

const findActiveDepositForBookingForUpdate = async (bookingId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select * from public.booking_payments
      where booking_id = $1
        and type = 'deposit'
        and status in ('initiated', 'pending', 'succeeded')
      order by created_at desc limit 1
      for update`,
    [bookingId],
  );
  return rows[0] || null;
};

const findActiveBalanceForBookingForUpdate = async (bookingId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select * from public.booking_payments
      where booking_id = $1 and type = 'balance'
        and status in ('initiated', 'pending', 'succeeded')
      order by created_at desc limit 1 for update`,
    [bookingId],
  );
  return rows[0] || null;
};

const findByProviderReferenceForUpdate = async (provider, reference, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select * from public.booking_payments
      where provider = $1 and provider_reference = $2
      for update`,
    [provider, reference],
  );
  return rows[0] || null;
};

const findForPassengerBookingReference = async (passengerId, bookingId, provider, reference) => {
  const { rows } = await query(
    `select * from public.booking_payments
      where passenger_id = $1 and booking_id = $2
        and provider = $3 and provider_reference = $4
      limit 1`,
    [passengerId, bookingId, provider, reference],
  );
  return rows[0] || null;
};

const markInitialized = async (id, { authorizationUrl, accessCode }, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.booking_payments
        set status = 'pending', authorization_url = $2, access_code = $3,
            updated_at = now()
      where id = $1 and status = 'initiated'
      returning *`,
    [id, authorizationUrl, accessCode],
  );
  return rows[0] || null;
};

const markSucceeded = async (id, { confirmedAt, channel, metadata }, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.booking_payments
        set status = 'succeeded', confirmed_at = coalesce(confirmed_at, $2, now()),
            provider_channel = coalesce($3, provider_channel),
            metadata = metadata || $4::jsonb, updated_at = now()
      where id = $1 and status in ('initiated', 'pending')
      returning *`,
    [id, confirmedAt || null, channel || null, JSON.stringify(metadata || {})],
  );
  return rows[0] || null;
};

const markFailed = async (id, { code, message } = {}, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.booking_payments
        set status = 'failed', failure_code = $2, failure_message = $3,
            failed_at = coalesce(failed_at, now()), updated_at = now()
      where id = $1 and status in ('initiated', 'pending')
      returning *`,
    [id, code || null, message || null],
  );
  return rows[0] || null;
};


module.exports = {
  insert,
  findByIdempotencyKeyForUpdate,
  findByIdForUpdate,
  listForBooking,
  listPendingRefunds,
  findActiveDepositForBookingForUpdate,
  findActiveBalanceForBookingForUpdate,
  findSucceededDepositForBookingForUpdate,
  findActiveRefundForParentForUpdate,
  findRefundByOriginalReferenceForUpdate,
  findByProviderReferenceForUpdate,
  findForPassengerBookingReference,
  markInitialized,
  markSucceeded,
  markFailed,
  markRefundPending,
  attachRefundProvider,
};
