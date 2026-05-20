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

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
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

app.use(notFound);
app.use(errorHandler);

module.exports = app;
