require('dotenv').config();
const { env } = require('./config/env');
const { pool } = require('./config/db');
const { closeAll: closeRedis } = require('./config/redis');
const scheduleWorker = require('./services/scheduleWorker.service');

let shuttingDown = false;
let timer = null;

const run = async () => {
  if (shuttingDown) return;
  try {
    const result = await scheduleWorker.runLockedCycle();
    if (result.skipped) console.log('[schedule-worker] cycle skipped: lock held by another instance');
  } catch (error) {
    console.error('[schedule-worker] failed:', error.message);
  }
};

console.log(`[schedule-worker] started; interval=${env.SCHEDULE_WORKER_INTERVAL_MS}ms`);
void run();
timer = setInterval(run, env.SCHEDULE_WORKER_INTERVAL_MS);

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (timer) clearInterval(timer);
  console.log(`[schedule-worker] received ${signal}, shutting down...`);
  await pool.end().catch((error) => console.error('[schedule-worker] database close failed:', error.message));
  await closeRedis().catch((error) => console.error('[schedule-worker] redis close failed:', error.message));
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => console.error('[schedule-worker] unhandledRejection', reason));
