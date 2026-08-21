import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pool, withTransaction, query } = require('../src/config/db');
const syncService = require('../src/services/sync.service');
const { purgeExpiredSyncData } = require('../src/services/syncRetention.service');

const USER_ID = '00000000-0000-0000-0000-000000000901';
const BUS_ID = '00000000-0000-0000-0000-000000000902';
const PHONE = '+233200000901';
const REGISTRATION = 'CI-SYNC-901';
const ROUTE_ID = 'b1000000-0000-0000-0000-000000000001';

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
    `insert into public.buses (id, registration, driver_id, route_id, total_seats, seats_available, status, driving_status)
     values ($1, $2, $3, $4, 14, 14, 'paused', 'STATIONARY')`,
    [BUS_ID, REGISTRATION, USER_ID, ROUTE_ID],
  );
};

const count = async (table, where, params) => {
  const { rows } = await query(`select count(*)::int as count from ${table} where ${where}`, params);
  return rows[0].count;
};

const runSpatialAssertions = async () => {
  const stops = await query(
    `select s.id, s.name, s.lat, s.lng, rs.sequence
       from public.route_stops rs
       join public.bus_stops s on s.id = rs.stop_id
      where rs.route_id = $1 and s.status = 'active'
      order by rs.sequence`,
    [ROUTE_ID],
  );
  assert.ok(stops.rows.length >= 2, 'seeded route must have at least two active stops');
  const nearest = await query(
    `select s.id,
            ST_Distance(s.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_m
       from public.bus_stops s
      where s.id = $3
        and ST_DWithin(s.geom, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, 50000)`,
    [stops.rows[0].lng, stops.rows[0].lat, stops.rows[0].id],
  );
  assert.equal(nearest.rows.length, 1, 'PostGIS stop proximity query must return the route stop');
  assert.ok(Number(nearest.rows[0].distance_m) < 1, 'stop distance to its own coordinates must be near zero');
  return { stopCount: stops.rows.length };
};

const runSeatConcurrencyAssertion = async () => {
  await query(
    `update public.buses set status = 'active', driving_status = 'EN_ROUTE', seats_available = 1 where id = $1`,
    [BUS_ID],
  );
  const reserve = () => withTransaction(async (client) => {
    const { rows } = await client.query(
      `update public.buses
          set seats_available = seats_available - 1
        where id = $1 and status = 'active' and driving_status = 'EN_ROUTE' and seats_available > 0
        returning id`,
      [BUS_ID],
    );
    return Boolean(rows[0]);
  });
  const results = await Promise.all([reserve(), reserve()]);
  assert.deepEqual(results.sort(), [false, true], 'concurrent last-seat reservations must allow exactly one winner');
  const bus = await query('select seats_available from public.buses where id = $1', [BUS_ID]);
  assert.equal(bus.rows[0].seats_available, 0, 'last-seat reservation must not oversell');
  return { winners: results.filter(Boolean).length };
};

const runRetentionAssertion = async () => {
  const old = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();
  await query(
    `insert into public.sync_mutations
      (user_id, device_id, event_id, idempotency_key, entity, operation, payload, client_created_at, status, processed_at, created_at)
     values ($1, 'ci-retention-device', 'ci-old-accepted', 'ci-old-accepted-key', 'driver_bus', 'set', '{}'::jsonb, $2, 'accepted', $2, $2),
            ($1, 'ci-retention-device', 'ci-old-processing', 'ci-old-processing-key', 'driver_bus', 'set', '{}'::jsonb, $2, 'processing', $2, $2)`,
    [USER_ID, old],
  );
  await query(
    `insert into public.sync_changes (audience_user_id, entity, entity_id, operation, payload, created_at)
     values ($1, 'driver_bus', $2, 'upsert', '{}'::jsonb, $3)`,
    [USER_ID, BUS_ID, old],
  );
  const result = await purgeExpiredSyncData({ now: new Date(), days: 90 });
  assert.ok(result.mutationsDeleted >= 1);
  assert.ok(result.changesDeleted >= 1);
  assert.equal(await count('public.sync_mutations', 'user_id = $1 and event_id = $2', [USER_ID, 'ci-old-accepted']), 0);
  assert.equal(await count('public.sync_mutations', 'user_id = $1 and event_id = $2', [USER_ID, 'ci-old-processing']), 1);
  return { mutationsDeleted: result.mutationsDeleted, changesDeleted: result.changesDeleted };
};

const run = async () => {
  const extension = await query('select postgis_version() as version');
  assert.ok(extension.rows[0]?.version, 'PostGIS must be available in CI');

  await seed();
  const spatial = await runSpatialAssertions();

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

  const seatConcurrency = await runSeatConcurrencyAssertion();
  await query(
    `update public.buses set status = 'active', driving_status = 'EN_ROUTE', seats_available = 4 where id = $1`,
    [BUS_ID],
  );

  const location = await syncService.processMutation(driver, {
    eventId: 'ci-event-location-901',
    idempotencyKey: 'ci-location-901',
    deviceId: 'ci-device-901',
    entity: 'driver_location',
    operation: 'update',
    payload: { lat: 5.6148, lng: -0.2059 },
    clientCreatedAt: new Date().toISOString(),
  });
  assert.equal(location.status, 'accepted');
  const updatedLocation = await query('select current_lat, current_lng from public.buses where id = $1', [BUS_ID]);
  assert.equal(Number(updatedLocation.rows[0].current_lat), 5.6148);
  assert.equal(Number(updatedLocation.rows[0].current_lng), -0.2059);
  const retention = await runRetentionAssertion();

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
    spatialStopCount: spatial.stopCount,
    seatWinners: seatConcurrency.winners,
    gpsSyncStatus: location.status,
    retention,
    rollbackVerified: true,
  }));
};

try {
  await run();
} finally {
  await cleanup().catch((error) => console.error('[integration-sync] cleanup failed', error.message));
  await pool.end();
}
