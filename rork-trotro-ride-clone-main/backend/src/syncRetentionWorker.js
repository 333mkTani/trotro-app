const { env } = require('./config/env');
const { pool } = require('./config/db');
const { closeAll } = require('./config/redis');
const { purgeExpiredSyncData } = require('./services/syncRetention.service');

let timer;
let running = false;

const parseRunTime = (value) => {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value || '').trim());
  if (!match) return { hours: 2, minutes: 0 };
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return { hours: 2, minutes: 0 };
  return { hours, minutes };
};

const nextRunDelayMs = (now = new Date()) => {
  const { hours, minutes } = parseRunTime(env.SYNC_RETENTION_RUN_AT_UTC);
  const next = new Date(now);
  next.setUTCHours(hours, minutes, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next.getTime() - now.getTime();
};

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

const scheduleNextRun = () => {
  const delay = nextRunDelayMs();
  console.log(`[sync-retention-worker] next run in ${Math.round(delay / 60000)} minutes at ${env.SYNC_RETENTION_RUN_AT_UTC} UTC`);
  timer = setTimeout(async () => {
    await run();
    scheduleNextRun();
  }, delay);
};

console.log(`[sync-retention-worker] started; runAt=${env.SYNC_RETENTION_RUN_AT_UTC} UTC days=${env.SYNC_RETENTION_DAYS}`);
scheduleNextRun();

const shutdown = async (signal) => {
  console.log(`[sync-retention-worker] received ${signal}, shutting down...`);
  clearTimeout(timer);
  await pool.end().catch((error) => console.error('[sync-retention-worker] database close failed', error));
  await closeAll().catch((error) => console.error('[sync-retention-worker] redis close failed', error));
  process.exit(0);
};

process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

module.exports = { nextRunDelayMs, parseRunTime };

/* istanbul ignore next */
if (require.main === module) {
  // The worker is intentionally kept alive by the scheduled timeout.
}
