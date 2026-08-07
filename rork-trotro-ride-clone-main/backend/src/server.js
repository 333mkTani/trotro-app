require('dotenv').config();
const http = require('http');
const app = require('./app');
const { env } = require('./config/env');
const { pool } = require('./config/db');
const { closeAll: closeRedis } = require('./config/redis');
const { attach: attachSocketIO } = require('./realtime/io');
const bookingService = require('./services/booking.service');

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

const shutdown = async (signal) => {
  clearInterval(bookingSweepTimer);
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
