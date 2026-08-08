const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  DATABASE_URL: process.env.DATABASE_URL || '',
  PGSSL: String(process.env.PGSSL || 'false').toLowerCase() === 'true',
  REDIS_URL: process.env.REDIS_URL || '',
  CACHE_TTL_SECONDS: parseInt(process.env.CACHE_TTL_SECONDS || '60', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || '',
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || '',
  SCHEDULED_RESERVATIONS_ENABLED:
    String(process.env.SCHEDULED_RESERVATIONS_ENABLED || 'false').toLowerCase() === 'true',
  SCHEDULED_RESERVATIONS_ROLLOUT_PERCENT:
    Math.min(100, Math.max(0, parseInt(process.env.SCHEDULED_RESERVATIONS_ROLLOUT_PERCENT || '0', 10))),
  SCHEDULE_TEST_NOW: process.env.SCHEDULE_TEST_NOW || '',
  SCHEDULE_WORKER_IN_WEB:
    String(process.env.SCHEDULE_WORKER_IN_WEB || 'true').toLowerCase() === 'true',
  SCHEDULE_WORKER_INTERVAL_MS:
    Math.max(10000, parseInt(process.env.SCHEDULE_WORKER_INTERVAL_MS || '60000', 10)),
  BUS_ALERT_WORKER_INTERVAL_MS:
    Math.max(5000, parseInt(process.env.BUS_ALERT_WORKER_INTERVAL_MS || '30000', 10)),
  BUS_ALERTS_ENABLED:
    String(process.env.BUS_ALERTS_ENABLED || 'true').toLowerCase() === 'true',
  BUS_ALERTS_ROLLOUT_PERCENT:
    Math.min(100, Math.max(0, parseInt(process.env.BUS_ALERTS_ROLLOUT_PERCENT || '100', 10))),
};

if (!env.DATABASE_URL) {
  console.warn('[trotro-api] WARNING: DATABASE_URL is not set');
}

if (!env.PAYSTACK_SECRET_KEY) {
  console.warn('[trotro-api] WARNING: PAYSTACK_SECRET_KEY is not set — wallet top-ups will fail');
}

module.exports = { env };
