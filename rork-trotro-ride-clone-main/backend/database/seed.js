#!/usr/bin/env node
/**
 * Seed runner — executes every `*.sql` file in `backend/database/seeds`
 * in lexical order. Seed files should be idempotent (use ON CONFLICT).
 *
 * Usage:
 *   node backend/database/seed.js
 *   npm --prefix backend run db:seed
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const { pool, withTransaction } = require('../src/config/db');

const SEEDS_DIR = path.join(__dirname, 'seeds');

const run = async () => {
  if (!fs.existsSync(SEEDS_DIR)) {
    console.log('[seed] no seeds dir, nothing to do.');
    await pool.end();
    return;
  }

  const files = fs.readdirSync(SEEDS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = fs.readFileSync(path.join(SEEDS_DIR, file), 'utf8');
    console.log(`[seed] apply  ${file}`);
    await withTransaction((client) => client.query(sql));
  }
  console.log(`[seed] done. ran ${files.length} seed file(s).`);
  await pool.end();
};

run().catch(async (err) => {
  console.error('[seed] failed', err);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
