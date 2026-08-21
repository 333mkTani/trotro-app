import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pool, withTransaction, query } = require('../src/config/db');
const syncService = require('../src/services/sync.service');

const USER_ID = '00000000-0000-0000-0000-000000000901';
const BUS_ID = '00000000-0000-0000-0000-000000000902';
const PHONE = '+233200000901';
const REGISTRATION = 'CI-SYNC-901';

const driver = { id: USER_ID, role: 'driver' };

const cleanup = async () => {
  await query('delete from public.sync_changes where audience_user_id = $1', [USER_ID]);
  await query('delete from public.sync_mutations where user_id = $1', [USER_ID]);
  await query('delete from public.buses where id = $1', [BUS_ID]);
  await query('delete from public.drivers where id = $1', [USER_ID]);
  await query('delete from public.profiles where id = $1', [USER_ID]);
  await query('delete from public.users where id = $1', [USER_ID]);
};

const seed = async () => {
  await cleanup();
  await query(
    `insert into public.users (id, phone, password_hash, is_verified)
     values ($1, $2, $3, true)`,
    [USER_ID, PHONE, 'ci-only-hash'],
  );
  await query(
    `insert into public.profiles (id, phone, full_name, role)
     values ($1, $2, 'CI Sync Driver', 'driver')`,
    [USER_ID, PHONE],
  );
  await query(
    `insert into public.drivers (id, full_name, phone, status)
     values ($1, 'CI Sync Driver', $2, 'active')`,
    [USER_ID, PHONE],
  );
  await query(
    `insert into public.buses (id, registration, driver_id, total_seats, seats_available, status, driving_status)
     values ($1, $2, $3, 14, 14, 'paused', 'STATIONARY')`,
    [BUS_ID, REGISTRATION, USER_ID],
  );
};

const count = async (table, where, params) => {
  const { rows } = await query(`select count(*)::int as count from ${table} where ${where}`, params);
  return rows[0].count;
};

const run = async () => {
  const extension = await query('select postgis_version() as version');
  assert.ok(extension.rows[0]?.version, 'PostGIS must be available in CI');

  await seed();

  const input = {
    eventId: 'ci-event-atomic-901',
    idempotencyKey: 'ci-idempotency-901',
    deviceId: 'ci-device-901',
    entity: 'driver_availability',
    operation: 'set',
    payload: { isAvailable: true },
    clientCreatedAt: new Date().toISOString(),
  };

  const concurrent = await Promise.all([
    syncService.processMutation(driver, input),
    syncService.processMutation(driver, input),
  ]);
  assert.deepEqual(
    concurrent.map((receipt) => receipt.status).sort(),
    ['accepted', 'duplicate'],
    'concurrent duplicate mutations must produce one acceptance and one duplicate',
  );
  assert.equal(await count('public.sync_mutations', 'user_id = $1 and event_id = $2', [USER_ID, input.eventId]), 1);
  assert.equal(await count('public.sync_changes', 'audience_user_id = $1 and entity_id = $2', [USER_ID, BUS_ID]), 1);

  const bus = await query('select status, driving_status from public.buses where id = $1', [BUS_ID]);
  assert.equal(bus.rows[0].status, 'active');
  assert.equal(bus.rows[0].driving_status, 'STATIONARY');

  const change = await query(
    `select entity, entity_id, operation, payload
       from public.sync_changes
      where audience_user_id = $1 and entity_id = $2`,
    [USER_ID, BUS_ID],
  );
  assert.deepEqual(change.rows[0], {
    entity: 'driver_bus',
    entity_id: BUS_ID,
    operation: 'upsert',
    payload: { busId: BUS_ID, status: 'active', drivingStatus: 'STATIONARY' },
  });

  const rollbackClient = await pool.connect();
  try {
    await rollbackClient.query('create temporary table ci_atomic_probe (value text)');
    await rollbackClient.query('begin');
    await rollbackClient.query('insert into ci_atomic_probe (value) values ($1)', ['must-rollback']);
    await rollbackClient.query('rollback');
    const rollbackProbe = await rollbackClient.query('select count(*)::int as count from ci_atomic_probe');
    assert.equal(rollbackProbe.rows[0].count, 0, 'failed transaction must roll back all writes');
  } finally {
    rollbackClient.release();
  }

  console.log(JSON.stringify({
    status: 'ok',
    postgis: extension.rows[0].version,
    concurrentStatuses: concurrent.map((receipt) => receipt.status),
    mutationCount: 1,
    changeCount: 1,
    rollbackVerified: true,
  }));
};

try {
  await run();
} finally {
  await cleanup().catch((error) => console.error('[integration-sync] cleanup failed', error.message));
  await pool.end();
}
