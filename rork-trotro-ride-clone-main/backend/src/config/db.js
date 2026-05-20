const { Pool } = require('pg');
const { env } = require('./env');

/**
 * Single shared PG pool. Works against any Postgres database including
 * Supabase. For Supabase, use the pooled "Transaction" connection string
 * (port 6543) in serverless environments.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.PGSSL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  console.error('[pg] idle client error', err);
});

/**
 * Execute a parameterized query.
 * @param {string} text
 * @param {any[]} [params]
 */
const query = (text, params) => pool.query(text, params);

/**
 * Run a function inside a transaction. Rolls back on error.
 * @param {(client: import('pg').PoolClient) => Promise<any>} fn
 */
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rbErr) {
      console.error('[pg] rollback failed', rbErr);
    }
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { pool, query, withTransaction };
