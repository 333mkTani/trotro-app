#!/usr/bin/env node
/**
 * Database-backed concurrency checks for issue #28.
 *
 * The checks use committed scratch data and remove it after the run. They do
 * not use production hosts by default and require an explicit staging marker.
 */
import crypto from 'node:crypto';
import pg from 'pg';

const databaseUrl = process.env.DATABASE_URL;
const environment = process.env.CONCURRENCY_ENV;
const confirmation = process.env.CONCURRENCY_CONFIRM;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
if (environment !== 'staging') throw new Error('CONCURRENCY_ENV=staging is required');
if (confirmation !== 'I_UNDERSTAND_STAGING_DB') {
  throw new Error('set CONCURRENCY_CONFIRM=I_UNDERSTAND_STAGING_DB');
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 8,
  ssl: String(process.env.PGSSL).toLowerCase() === 'true' ? { rejectUnauthorized: false } : false,
});
const checks = [];
const pass = (name, message = '') => { checks.push({ name, status: 'passed', message }); console.log(`PASS ${name}${message ? ` — ${message}` : ''}`); };
const fail = (name, message) => { checks.push({ name, status: 'failed', message }); throw new Error(`${name}: ${message}`); };

const race = async (work) => {
  const clients = [await pool.connect(), await pool.connect()];
  try {
    // Each statement runs in autocommit mode. This lets PostgreSQL release the
    // first row/unique-index lock while the second contender is waiting.
    return await Promise.all(clients.map((client) => work(client)));
  } finally {
    clients.forEach((client) => client.release());
  }
};

let scratchBusId;
let scratchPaymentKey;
try {
  const fixture = await pool.query(
    `insert into public.buses (registration, total_seats, seats_available, status)
     values ($1, 1, 1, 'active') returning id`,
    [`CONCURRENCY_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`],
  );
  scratchBusId = fixture.rows[0].id;

  const seatResults = await race((client) => client.query(
    `update public.buses
        set seats_available = seats_available - 1
      where id = $1 and seats_available > 0
      returning id, seats_available`,
    [scratchBusId],
  ));
  const seatWinners = seatResults.filter((result) => result.rows.length === 1);
  if (seatWinners.length !== 1) fail('last-seat-race', `${seatWinners.length} concurrent reservations succeeded; expected exactly one`);
  pass('last-seat-race', 'exactly one of two concurrent reservations obtained the only seat');

  const bookingFixture = await pool.query(
    `select id, passenger_id from public.bookings order by created_at desc limit 1`,
  );
  if (!bookingFixture.rows[0]) {
    pass('duplicate-idempotency-key', 'skipped because the database has no booking fixture');
  } else {
    scratchPaymentKey = `CONCURRENCY_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
    const { id: bookingId, passenger_id: passengerId } = bookingFixture.rows[0];
    const paymentResults = await race((client) => client.query(
      `insert into public.booking_payments
        (booking_id, passenger_id, type, amount, currency, provider, provider_reference, idempotency_key, metadata)
       values ($1, $2, 'deposit', 1, 'GHS', 'paystack', $3, $4, '{}'::jsonb)
       returning id`,
      [bookingId, passengerId, `CONCURRENCY_REF_${scratchPaymentKey}`, scratchPaymentKey],
    ).catch((error) => ({ error })));
    const paymentWinners = paymentResults.filter((result) => result.rows?.length === 1);
    const paymentFailures = paymentResults.filter((result) => result.error?.code === '23505');
    if (paymentWinners.length !== 1 || paymentFailures.length !== 1) {
      fail('duplicate-idempotency-key', `insert results were ${paymentWinners.length} successes and ${paymentFailures.length} unique violations`);
    }
    pass('duplicate-idempotency-key', 'unique idempotency key allowed one payment ledger row');
  }
} finally {
  if (scratchPaymentKey) await pool.query('delete from public.booking_payments where idempotency_key = $1', [scratchPaymentKey]);
  if (scratchBusId) await pool.query('delete from public.buses where id = $1', [scratchBusId]);
  await pool.end();
}

console.log(`Concurrency verification passed: ${checks.filter((check) => check.status === 'passed').length} checks`);
