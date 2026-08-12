const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');

const { env } = require('./config/env');
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
const adminDashboardRoutes = require('./routes/adminDashboard.routes');

const app = express();

app.disable('x-powered-by');
// Render terminates TLS in front of this process and supplies the original
// client address in X-Forwarded-For. Trust exactly that first proxy hop so
// Express and express-rate-limit key requests by the passenger/driver IP,
// rather than grouping every device under Render's internal proxy address.
app.set('trust proxy', 1);
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

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'trotro-api', time: new Date().toISOString() });
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

app.use(notFound);
app.use(errorHandler);

module.exports = app;
