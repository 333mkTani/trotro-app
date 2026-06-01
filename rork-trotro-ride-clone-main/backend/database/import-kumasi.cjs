'use strict';
// Seed Kumasi GTFS data into the trotro project schema (CommonJS version)
// Usage: node database/import-kumasi.cjs [path/to/gtfs_kumasi_seed.sql]
// Requires: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
// Run migration 015_city_column.sql in Supabase BEFORE running this script.

require('dotenv/config');
const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { resolve } = require('path');
const { randomUUID } = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env file.');
  process.exit(1);
}

const SQL_FILE = process.argv[2]
  || resolve('C:/Users/Mawuli Kutani/Downloads/kumasi routes/gtfs_kumasi_seed.sql');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function batchInsert(table, rows, size = 200) {
  let done = 0;
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + size));
    if (error) {
      console.error(`\n❌  ${table} batch ${i}:`, error.message);
      process.exit(1);
    }
    done += Math.min(size, rows.length - i);
    process.stdout.write(`\r   ${table}: ${done}/${rows.length}`);
  }
  console.log(`\r✅  ${table}: ${done} records inserted          `);
}

function estimateFare(km) {
  if (km < 3)  return 2.00;
  if (km < 6)  return 3.00;
  if (km < 10) return 4.00;
  if (km < 15) return 5.50;
  if (km < 20) return 7.00;
  return 9.00;
}

function inferStopType(name) {
  const n = name.toLowerCase();
  if (n.includes('station') || n.includes('terminal') || n.includes('roundab')) return 'station';
  return 'stop';
}

function extractValuesBlock(sql, table) {
  const re = new RegExp(
    `INSERT INTO (?:public\\.)?${table}(?:\\s*\\([^)]+\\))?\\s+VALUES([\\s\\S]+?);`,
    'i'
  );
  const m = sql.match(re);
  if (!m) throw new Error(`Could not find INSERT INTO ${table} in SQL file`);
  return m[1].trim();
}

function splitRows(block) {
  const rows = [];
  let depth = 0, start = -1, i = 0, inStr = false;

  while (i < block.length) {
    const ch = block[i];
    if (ch === "'" && !inStr) { inStr = true; i++; continue; }
    if (inStr) {
      if (ch === "'" && block[i + 1] === "'") { i += 2; continue; }
      if (ch === "'") { inStr = false; i++; continue; }
      i++; continue;
    }
    if (ch === '(') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0 && start !== -1) {
        rows.push(block.slice(start, i));
        start = -1;
      }
    }
    i++;
  }
  return rows;
}

function parseRow(row) {
  const values = [];
  let i = 0;
  row = row.trim();

  while (i < row.length) {
    while (i < row.length && (row[i] === ',' || row[i] === ' ' || row[i] === '\n' || row[i] === '\r')) i++;
    if (i >= row.length) break;

    if (row[i] === "'") {
      let s = '';
      i++;
      while (i < row.length) {
        if (row[i] === "'" && row[i + 1] === "'") { s += "'"; i += 2; }
        else if (row[i] === "'") { i++; break; }
        else { s += row[i++]; }
      }
      values.push(s);
    } else {
      let token = '';
      while (i < row.length && row[i] !== ',' && row[i] !== ')') token += row[i++];
      token = token.trim();
      if (token === 'true') values.push(true);
      else if (token === 'false') values.push(false);
      else if (token === 'null' || token === 'NULL') values.push(null);
      else if (token.includes('.')) values.push(parseFloat(token));
      else values.push(parseInt(token, 10));
    }
  }
  return values;
}

async function main() {
  console.log('\n🚌  Kumasi GTFS → Supabase (trotro schema)');
  console.log('============================================\n');

  console.log(`📂  Reading: ${SQL_FILE}`);
  const sql = readFileSync(SQL_FILE, 'utf8');

  console.log('\n📍  Parsing stops...');
  const stopsBlock = extractValuesBlock(sql, 'stops');
  const stopRows   = splitRows(stopsBlock);

  const stopIdMap = new Map();
  const busStops = stopRows.map(raw => {
    const [id, name, lat, lng] = parseRow(raw);
    const uuid = randomUUID();
    stopIdMap.set(id, uuid);
    return { id: uuid, name: String(name), type: inferStopType(String(name)), lat, lng, status: 'active', city: 'kumasi' };
  });
  console.log(`   Parsed ${busStops.length} stops`);

  console.log('\n🗺️   Parsing routes...');
  const routesBlock = extractValuesBlock(sql, 'routes');
  const routeRows   = splitRows(routesBlock);

  const routeIdMap = new Map();
  const routes = routeRows.map(raw => {
    const [id, name, origin, destination, distanceKm, durationMin, , isActive] = parseRow(raw);
    const uuid = randomUUID();
    routeIdMap.set(id, uuid);
    return {
      id: uuid, name: String(name), origin: String(origin), destination: String(destination),
      distance_km: distanceKm, duration_min: durationMin, fare: estimateFare(distanceKm),
      status: isActive ? 'active' : 'paused', city: 'kumasi',
    };
  });
  console.log(`   Parsed ${routes.length} routes`);

  console.log('\n🔗  Parsing route_stops...');
  const rsBlock = extractValuesBlock(sql, 'route_stops');
  const rsRows  = splitRows(rsBlock);

  const seen = new Set();
  const routeStops = [];
  let skipped = 0;
  for (const raw of rsRows) {
    const [routeIntId, stopIntId, sequence] = parseRow(raw);
    const routeUuid = routeIdMap.get(routeIntId);
    const stopUuid  = stopIdMap.get(stopIntId);
    if (!routeUuid || !stopUuid) { skipped++; continue; }
    const key = `${routeUuid}:${stopUuid}`;
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    routeStops.push({ route_id: routeUuid, stop_id: stopUuid, sequence });
  }
  console.log(`   Parsed ${routeStops.length} route_stops (${skipped} skipped — unmatched or duplicate)`);

  console.log('\n🧹  Clearing existing Kumasi data...');
  const { error: rErr } = await supabase.from('routes').delete().eq('city', 'kumasi');
  if (rErr) { console.error('❌  routes delete:', rErr.message); process.exit(1); }
  const { error: sErr } = await supabase.from('bus_stops').delete().eq('city', 'kumasi');
  if (sErr) { console.error('❌  bus_stops delete:', sErr.message); process.exit(1); }
  console.log('✅  Cleared\n');

  await batchInsert('bus_stops',   busStops);
  await batchInsert('routes',      routes);
  await batchInsert('route_stops', routeStops);

  console.log('\n🎉  Done! Kumasi data loaded alongside Accra in Supabase.');
  console.log(`    Stops: ${busStops.length} · Routes: ${routes.length} · Route-stops: ${routeStops.length}\n`);
}

main().catch(err => { console.error('\n💥 ', err.message); process.exit(1); });
