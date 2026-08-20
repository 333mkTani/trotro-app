#!/usr/bin/env node
/**
 * Verify a migrated Trotro database. This script is intentionally non-destructive:
 * it reads schema/data and uses a transaction/savepoint for constraint probes.
 * Point DATABASE_URL at a fresh database after running npm run migrate.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(2);
}

const expectedMigrations = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
const pool = new pg.Pool({ connectionString: databaseUrl, ssl: String(process.env.PGSSL).toLowerCase() === 'true' ? { rejectUnauthorized: false } : false });
const failures = [];
const pass = (name, detail = '') => console.log(`PASS ${name}${detail ? ` — ${detail}` : ''}`);
const fail = (name, detail) => { console.error(`FAIL ${name}${detail ? ` — ${detail}` : ''}`); failures.push(name); };
const assert = (name, condition, detail = '') => condition ? pass(name, detail) : fail(name, detail || 'assertion failed');
const query = (text, params = []) => pool.query(text, params);

async function hasTable(name) {
  const { rows } = await query(`select to_regclass($1) is not null as present`, [`public.${name}`]);
  return rows[0].present;
}

async function hasIndex(name) {
  const { rows } = await query(`select to_regclass($1) is not null as present`, [`public.${name}`]);
  return rows[0].present;
}

async function hasConstraint(name) {
  const { rows } = await query(`select exists (select 1 from pg_constraint where conname = $1) as present`, [name]);
  return rows[0].present;
}

async function probeSeatConstraint() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('select id from public.buses order by id limit 1');
    if (!rows[0]) return fail('seat-capacity.constraint-probe', 'no seeded bus available');
    await client.query('begin');
    await client.query('savepoint seat_probe');
    try {
      await client.query('update public.buses set seats_available = total_seats + 1 where id = $1', [rows[0].id]);
      await client.query('rollback to savepoint seat_probe');
      fail('seat-capacity.constraint-probe', 'an over-capacity update unexpectedly succeeded');
    } catch (_) {
      await client.query('rollback to savepoint seat_probe');
      pass('seat-capacity.constraint-probe', 'over-capacity update rejected');
    }
    await client.query('rollback');
  } finally {
    client.release();
  }
}

async function main() {
  try {
    const { rows: migrationRows } = await query('select filename from public.schema_migrations order by filename');
    const applied = migrationRows.map((row) => row.filename);
    assert('migrations.complete', applied.length === expectedMigrations.length && expectedMigrations.every((name, index) => applied[index] === name), `${applied.length}/${expectedMigrations.length} migration files recorded`);
    assert('extension.postgis', (await query("select exists (select 1 from pg_extension where extname = 'postgis') as present")).rows[0].present);

    for (const table of ['bus_stops', 'routes', 'route_stops', 'buses', 'bookings']) {
      assert(`table.${table}`, await hasTable(table));
    }
    for (const index of ['bus_stops_geom_idx', 'buses_geom_idx', 'bookings_due_provisional_holds_idx', 'bookings_due_boarding_idx']) {
      assert(`index.${index}`, await hasIndex(index));
    }
    for (const constraint of ['route_stops_pkey', 'route_stops_route_id_stop_id_key', 'buses_seat_capacity_check']) {
      assert(`constraint.${constraint}`, await hasConstraint(constraint));
    }

    const { rows: stopRows } = await query('select id, lat, lng from public.bus_stops where geom is not null order by id limit 1');
    assert('spatial.seed-stop', Boolean(stopRows[0]), 'a seeded stop with geometry exists');
    if (stopRows[0]) {
      const { rows } = await query(`select st_dwithin(geom, st_setsrid(st_makepoint($1, $2), 4326)::geography, 1) as within from public.bus_stops where id = $3`, [stopRows[0].lng, stopRows[0].lat, stopRows[0].id]);
      assert('spatial.self-radius-query', rows[0].within === true, 'a stop is within 1 metre of its synchronized geometry');
    }

    const { rows: routeRows } = await query(`select route_id, array_agg(sequence order by sequence) as sequences from public.route_stops group by route_id having count(*) > 1 order by route_id limit 1`);
    assert('route-stops.seed-order', Boolean(routeRows[0]), 'a seeded route has at least two stops');
    if (routeRows[0]) {
      const sequences = routeRows[0].sequences.map(Number);
      assert('route-stops.strict-order', sequences.every((value, index) => index === 0 || value > sequences[index - 1]), sequences.join(' → '));
    }

    const { rows: busRows } = await query('select count(*)::int as total, count(*) filter (where seats_available between 0 and total_seats)::int as valid from public.buses');
    assert('seat-capacity.seed-values', busRows[0].total > 0 && busRows[0].total === busRows[0].valid, `${busRows[0].valid}/${busRows[0].total} buses within capacity`);
    await probeSeatConstraint();

    const { rows: routeStopCount } = await query('select count(*)::int as count from public.route_stops');
    assert('route-stops.seed-data', routeStopCount[0].count > 0, `${routeStopCount[0].count} route-stop rows`);

    if (failures.length) process.exitCode = 1;
    else console.log('\nAll database verification checks passed.');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`Database verification aborted: ${error.message}`);
  process.exit(1);
});
