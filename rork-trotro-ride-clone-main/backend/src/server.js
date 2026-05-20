require('dotenv').config();
const http = require('http');
const app = require('./app');
const { env } = require('./config/env');
const { pool } = require('./config/db');
const { closeAll: closeRedis } = require('./config/redis');
const { attach: attachSocketIO } = require('./realtime/io');

const server = http.createServer(app);
const io = attachSocketIO(server);
app.set('io', io);

server.listen(env.PORT, () => {
  console.log(`[trotro-api] listening on :${env.PORT} (${env.NODE_ENV})`);
});

const shutdown = async (signal) => {
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
