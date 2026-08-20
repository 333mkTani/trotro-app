const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');

const { env } = require('./config/env');
const { pool } = require('./config/db');
const { client: redisClient, isReady: redisReady } = require('./config/redis');
const { notFound, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const routeRoutes = require('./routes/route.routes');
const stopRoutes = require('./routes/stop.routes');
const busRoutes = require('./routes/bus.routes');
const driverRoutes = require('./routes/driver.routes');
const driverProfileRoutes = require('./routes/driverProfile.routes');
const bookingRoutes = require('./routes/booking.routes');
const codeRoutes = require('./routes/code.routes');
const alertRoutes = require('./routes/alert.routes');
const walletRoutes = require('./routes/wallet.routes');
const ratingRoutes = require('./routes/rating.routes');
const webhookRoutes = require('./routes/webhook.routes');
const commuterScheduleRoutes = require('./routes/commuterSchedule.routes');
const driverScheduleRoutes = require('./routes/driverSchedule.routes');
const scheduleNotificationRoutes = require('./routes/scheduleNotification.routes');
const scheduleOperationsRoutes = require('./routes/scheduleOperations.routes');
const busAlertOperationsRoutes = require('./routes/busAlertOperations.routes');
const routingRoutes = require('./routes/routing.routes');
const departureSlotRoutes = require('./routes/departureSlot.routes');
const paymentOperationsRoutes = require('./routes/paymentOperations.routes');
const syncRoutes = require('./routes/sync.routes');
const adminDashboardRoutes = require('./routes/adminDashboard.routes');

const app = express();

// Render terminates TLS in front of this process and supplies the original
// client address in X-Forwarded-For. Trusting that hop is what lets Express
// and express-rate-limit key requests by the passenger/driver IP instead of
// grouping every device under Render's internal proxy address. Must come
// before the rate limiter, which reads req.ip. The hop count is configurable
// because it depends on what sits in front — see env.TRUST_PROXY.
app.set('trust proxy', env.TRUST_PROXY);
app.disable('x-powered-by');
app.use(helmet());
// CORS_ORIGIN accepts '*' or a comma-separated allow-list, so the admin web
// app can be served from its own origin without opening the API to everyone.
const corsOrigin = env.CORS_ORIGIN === '*'
  ? '*'
  : env.CORS_ORIGIN.split(',').map((value) => value.trim()).filter(Boolean);
app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({
  limit: '1mb',
  // Paystack webhook signatures are computed over the exact raw request
  // body — stash it here since express.json() would otherwise discard it
  // after parsing.
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiter — backed by Redis when available so limits are shared across
// multiple Node instances. Falls back to the default in-memory store otherwise.
const limiterOptions = {
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
};
if (env.REDIS_URL && redisClient) {
  limiterOptions.store = new RedisStore({
    sendCommand: (...args) => {
      if (!redisReady()) throw new Error('redis not ready');
      return redisClient.call(...args);
    },
    prefix: 'rl:api:',
  });
}
app.use('/api', rateLimit(limiterOptions));

// `ip` is the address the server resolved for the caller — their own, and
// nobody else's. It is reported so the TRUST_PROXY hop count can be verified
// from a browser: if it does not match the caller's public IP, the rate
// limiter is counting proxies instead of users.
app.get('/health', (req, res) => {
  res.json({
    ok: true, service: 'trotro-api', time: new Date().toISOString(), ip: req.ip,
  });
});

// Liveness and readiness are intentionally separate. Render can keep a process
// running while a dependency is unavailable, but traffic should only be sent to
// an instance that can reach its database and, when configured, Redis.
app.get('/ready', async (_req, res) => {
  const checks = { database: false, redis: !env.REQUIRE_REDIS };
  try {
    await pool.query('select 1');
    checks.database = true;
  } catch (error) {
    console.error('[ready] database check failed:', error.message);
  }
  if (env.REQUIRE_REDIS) checks.redis = Boolean(redisReady());
  const ok = checks.database && checks.redis;
  res.status(ok ? 200 : 503).json({
    ok, service: 'trotro-api', checks, time: new Date().toISOString(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/stops', stopRoutes);
app.use('/api/buses', busRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/drivers', driverProfileRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/codes', codeRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/commuter-schedules', commuterScheduleRoutes);
app.use('/api/driver-schedules', driverScheduleRoutes);
app.use('/api/schedule-notifications', scheduleNotificationRoutes);
app.use('/api/admin/schedules', scheduleOperationsRoutes);
app.use('/api/admin/bus-alerts', busAlertOperationsRoutes);
app.use('/api/admin/payments', paymentOperationsRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/departure-slots', departureSlotRoutes);
app.use('/api/sync', syncRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
