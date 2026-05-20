/**
 * Migration runner — executes SQL files from database/migrations/ in order.
 * Tracks completed migrations in a _migrations table so each file only runs once.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations');

async function run() {
  const client = await pool.connect();
  try {
    // Create tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        run_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const { rows: completed } = await client.query('SELECT filename FROM _migrations');
    const ran = new Set(completed.map((r) => r.filename));

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (ran.has(file)) {
        console.log(`[migrate] skip  ${file}`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[migrate] run   ${file}`);
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        count++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[migrate] FAILED ${file}:`, err.message);
        process.exit(1);
      }
    }

    console.log(`[migrate] done — ${count} migration(s) applied.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('[migrate] Unexpected error:', err);
  process.exit(1);
});
