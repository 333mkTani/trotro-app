#!/usr/bin/env node
/**
 * Simple SQL migration runner.
 *
 * - Tracks applied files in `public.schema_migrations`
 * - Runs every `*.sql` file in `backend/database/migrations` in lexical order
 * - Each file is executed inside a transaction
 *
 * Usage:
 *   node backend/database/migrate.js
 *   npm --prefix backend run db:migrate
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { pool, withTransaction } = require('../src/config/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const ensureMigrationsTable = async () => {
  await pool.query(`
    create table if not exists public.schema_migrations (
      filename    text primary key,
      applied_at  timestamptz not null default now()
    );
  `);
};

const getApplied = async () => {
  const { rows } = await pool.query('select filename from public.schema_migrations');
  return new Set(rows.map((r) => r.filename));
};

const run = async () => {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`[migrate] missing dir: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  await ensureMigrationsTable();
  const applied = await getApplied();

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`[migrate] skip   ${file}`);
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    console.log(`[migrate] apply  ${file}`);
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query('insert into public.schema_migrations(filename) values ($1)', [file]);
    });
    count += 1;
  }

  console.log(`[migrate] done. applied ${count} new migration(s).`);
  await pool.end();
};

run().catch(async (err) => {
  console.error('[migrate] failed', err);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
