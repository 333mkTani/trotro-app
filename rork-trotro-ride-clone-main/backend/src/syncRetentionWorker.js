const { env } = require('./config/env');
const { pool } = require('./config/db');
const { closeAll } = require('./config/redis');
const { purgeExpiredSyncData } = require('./services/syncRetention.service');

let timer;
let running = false;

const run = async () => {
  if (running) return;
  running = true;
  try {
    const result = await purgeExpiredSyncData();
    console.log('[sync-retention-worker] completed', result);
  } catch (error) {
    console.error('[sync-retention-worker] failed', error);
  } finally {
    running = false;
  }
};

console.log(`[sync-retention-worker] started; interval=${env.SYNC_RETENTION_INTERVAL_MS}ms days=${env.SYNC_RETENTION_DAYS}`);
void run();
timer = setInterval(() => { void run(); }, env.SYNC_RETENTION_INTERVAL_MS);

const shutdown = async (signal) => {
  console.log(`[sync-retention-worker] received ${signal}, shutting down...`);
  clearInterval(timer);
  await pool.end().catch((error) => console.error('[sync-retention-worker] database close failed', error));
  await closeAll().catch((error) => console.error('[sync-retention-worker] redis close failed', error));
  process.exit(0);
};

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
