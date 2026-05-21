const { Pool } = require('pg');
const { env } = require('./env');

// Parse URL manually — pg's built-in parser truncates usernames containing dots
// (Supabase Transaction Pooler uses "postgres.PROJECT-REF" as the username)
function buildPoolConfig(databaseUrl, useSsl) {
  if (!databaseUrl) return {};
  const u = new URL(databaseUrl);
  return {
    host: u.hostname,
    port: parseInt(u.port, 10) || 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  };
}

const pool = new Pool({
  ...buildPoolConfig(env.DATABASE_URL, env.PGSSL),
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
