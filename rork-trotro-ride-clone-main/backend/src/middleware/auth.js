const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
const { ApiError } = require('../utils/ApiError');

/**
 * Verifies a Bearer JWT and attaches `req.user = { id, role }`.
 * Supports both:
 *  - Custom JWTs issued by this API (signed with JWT_SECRET)
 *  - Supabase Auth JWTs (signed with SUPABASE_JWT_SECRET) when configured.
 *
 * For Supabase tokens the `sub` claim is the auth user UUID. The role is
 * read from `app_metadata.role`, then `user_metadata.role`, defaulting to
 * `passenger`.
 */
const requireAuth = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized('Missing bearer token'));

  const secrets = [];
  if (env.SUPABASE_JWT_SECRET) secrets.push({ secret: env.SUPABASE_JWT_SECRET, source: 'supabase' });
  if (env.JWT_SECRET) secrets.push({ secret: env.JWT_SECRET, source: 'custom' });

  for (const { secret, source } of secrets) {
    try {
      const payload = jwt.verify(token, secret);
      const role =
        payload.role && payload.role !== 'authenticated'
          ? payload.role
          : payload.app_metadata?.role ||
            payload.user_metadata?.role ||
            (source === 'supabase' ? 'passenger' : payload.role) ||
            'passenger';
      req.user = { id: payload.sub, role, email: payload.email, phone: payload.phone };
      return next();
    } catch (_err) {
      // try next secret
    }
  }

  return next(ApiError.unauthorized('Invalid or expired token'));
};

/**
 * Restricts a route to one or more roles. Use after requireAuth.
 * @param  {...('passenger'|'driver'|'admin')} roles
 */
const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) return next(ApiError.forbidden('Insufficient role'));
  return next();
};

module.exports = { requireAuth, requireRole };
