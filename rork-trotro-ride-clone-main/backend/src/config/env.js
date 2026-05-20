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
};

if (!env.DATABASE_URL) {
  console.warn('[trotro-api] WARNING: DATABASE_URL is not set');
}

module.exports = { env };
