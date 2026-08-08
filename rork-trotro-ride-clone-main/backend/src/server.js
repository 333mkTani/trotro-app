require('dotenv').config();
const http = require('http');
const app = require('./app');
const { env } = require('./config/env');
const { pool } = require('./config/db');
const { closeAll: closeRedis } = require('./config/redis');
const { attach: attachSocketIO } = require('./realtime/io');
const bookingService = require('./services/booking.service');
const scheduleDispatchService = require('./services/scheduleDispatch.service');
const scheduleLifecycleService = require('./services/scheduleLifecycle.service');
const busAlertWorkerService = require('./services/busAlertWorker.service');

const server = http.createServer(app);
const io = attachSocketIO(server);
app.set('io', io);

server.listen(env.PORT, () => {
  console.log(`[trotro-api] listening on :${env.PORT} (${env.NODE_ENV})`);
});

const sweepStaleBookings = async () => {
  try {
    const expired = await bookingService.expireStale(4);
    if (expired.length) console.log(`[booking-sweeper] expired ${expired.length} stale booking(s)`);
  } catch (err) {
    console.error('[booking-sweeper] failed:', err.message);
  }
};
const bookingSweepTimer = setInterval(sweepStaleBookings, 10 * 60 * 1000);
setTimeout(sweepStaleBookings, 15 * 1000);

let scheduleCycleRunning = false;
const runScheduleCycle = async () => {
  if (scheduleCycleRunning) return;
  scheduleCycleRunning = true;
  try {
    const result = await scheduleDispatchService.runCycle();
    const lifecycle = await scheduleLifecycleService.runCycle();
    if (lifecycle.opened || lifecycle.noShows) {
      console.log('[schedule-lifecycle-worker] cycle', lifecycle);
    }
    if (result.created || result.reminders || result.expired || result.notifications) {
      console.log('[schedule-worker] cycle', result);
    }
  } catch (err) {
    console.error('[schedule-worker] failed:', err.message);
  } finally {
    scheduleCycleRunning = false;
  }
};
const scheduleCycleTimer = setInterval(runScheduleCycle, 60 * 1000);
setTimeout(runScheduleCycle, 20 * 1000);

let busAlertCycleRunning = false;
const runBusAlertCycle = async () => {
  if (busAlertCycleRunning) return;
  busAlertCycleRunning = true;
  try {
    await busAlertWorkerService.runCycle();
  } catch (err) {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(), level: 'error',
      event: 'bus_alert.worker.failed', error: err.message,
    }));
  } finally {
    busAlertCycleRunning = false;
  }
};
const busAlertCycleTimer = setInterval(runBusAlertCycle, env.BUS_ALERT_WORKER_INTERVAL_MS);
setTimeout(runBusAlertCycle, 25 * 1000);

const shutdown = async (signal) => {
  clearInterval(bookingSweepTimer);
  clearInterval(scheduleCycleTimer);
  clearInterval(busAlertCycleTimer);
  console.log(`[trotro-api] received ${signal}, shutting down...`);
  try {
    if (io) await new Promise((resolve) => io.close(() => resolve()));
  } catch (err) {
    console.error('[trotro-api] error closing socket.io', err);
  }
  server.close(async () => {
    try {
      await pool.end();
    } catch (err) {
      console.error('[trotro-api] error closing pg pool', err);
    }
    try {
      await closeRedis();
    } catch (err) {
      console.error('[trotro-api] error closing redis', err);
    }
    process.exit(0);
  });
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason) => {
  console.error('[trotro-api] unhandledRejection', reason);
});
