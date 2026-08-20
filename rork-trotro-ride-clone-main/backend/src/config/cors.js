const parseCorsOrigins = (value) => {
  const normalized = String(value || '').trim();
  if (normalized === '*') return { wildcard: true, origins: new Set() };
  const origins = normalized
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  return { wildcard: false, origins: new Set(origins) };
};

const createOriginChecker = (value) => {
  const policy = parseCorsOrigins(value);
  return (origin, callback) => {
    // Requests without an Origin header include native clients, server-to-server
    // calls, and health checks. They are not browser cross-origin requests.
    if (!origin || policy.wildcard || policy.origins.has(origin)) return callback(null, true);
    return callback(null, false);
  };
};

const isOriginAllowed = (value, origin) => {
  const policy = parseCorsOrigins(value);
  return !origin || policy.wildcard || policy.origins.has(origin);
};

module.exports = { parseCorsOrigins, createOriginChecker, isOriginAllowed };
