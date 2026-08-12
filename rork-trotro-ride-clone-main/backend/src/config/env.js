const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  // How many reverse proxies sit in front of the API. Express needs this to
  // resolve the real client IP from X-Forwarded-For; left unset, every request
  // appears to come from the proxy and the rate limiter buckets the entire
  // platform into a single counter. Render on its own is 1 hop, Render behind
  // Cloudflare is 2. GET /health echoes the IP the server resolved, so the
  // value can be checked against the caller's real address.
  TRUST_PROXY: (() => {
    const hops = parseInt(process.env.TRUST_PROXY || '1', 10);
    return Number.isInteger(hops) && hops >= 0 ? hops : 1;
  })(),
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
  MAPBOX_ACCESS_TOKEN: process.env.MAPBOX_ACCESS_TOKEN || '',
  MAPBOX_DIRECTIONS_BASE_URL:
    process.env.MAPBOX_DIRECTIONS_BASE_URL || 'https://api.mapbox.com',
  ROUTING_CACHE_TTL_SECONDS:
    Math.max(1, parseInt(process.env.ROUTING_CACHE_TTL_SECONDS || '30', 10)),
  ROUTING_REQUEST_TIMEOUT_MS:
    Math.max(1000, parseInt(process.env.ROUTING_REQUEST_TIMEOUT_MS || '8000', 10)),
  ROUTING_RATE_LIMIT_MAX:
    Math.max(1, parseInt(process.env.ROUTING_RATE_LIMIT_MAX || '30', 10)),
  ROUTING_RATE_LIMIT_WINDOW_MS:
    Math.max(1000, parseInt(process.env.ROUTING_RATE_LIMIT_WINDOW_MS || '60000', 10)),
  MAPBOX_CACHE_TTL_WALKING_SECONDS:
    Math.max(1, parseInt(process.env.MAPBOX_CACHE_TTL_WALKING_SECONDS || '120', 10)),
  MAPBOX_CACHE_TTL_DRIVING_SECONDS:
    Math.max(1, parseInt(process.env.MAPBOX_CACHE_TTL_DRIVING_SECONDS || '30', 10)),
  MAPBOX_CACHE_TTL_TRAFFIC_SECONDS:
    Math.max(1, parseInt(process.env.MAPBOX_CACHE_TTL_TRAFFIC_SECONDS || '15', 10)),
  MAPBOX_DRIVING_TRAFFIC_ENABLED:
    String(process.env.MAPBOX_DRIVING_TRAFFIC_ENABLED || 'false').toLowerCase() === 'true',
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
