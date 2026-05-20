/**
 * Thin Redis-backed cache helpers.
 *
 * `wrap(key, ttl, loader)` returns the cached value or runs the loader
 * (and stores the result). All helpers degrade to a passthrough when
 * Redis is unavailable, so business logic does not have to branch.
 */
const { client, isReady, safeCall } = require('../config/redis');
const { env } = require('../config/env');

const DEFAULT_TTL = env.CACHE_TTL_SECONDS;

const get = async (key) => {
  const raw = await safeCall(() => client.get(key));
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
};

const set = async (key, value, ttlSeconds = DEFAULT_TTL) =>
  safeCall(() => client.set(key, JSON.stringify(value), 'EX', ttlSeconds));

const del = async (...keys) => {
  if (keys.length === 0) return 0;
  return safeCall(() => client.del(keys), 0);
};

/** Delete every key matching a glob pattern using SCAN (safe in prod). */
const delByPattern = async (pattern) =>
  safeCall(async () => {
    const stream = client.scanStream({ match: pattern, count: 100 });
    const pipeline = client.pipeline();
    let count = 0;
    for await (const keys of stream) {
      if (keys.length > 0) {
        pipeline.del(keys);
        count += keys.length;
      }
    }
    if (count > 0) await pipeline.exec();
    return count;
  }, 0);

const wrap = async (key, ttlSeconds, loader) => {
  if (!isReady()) return loader();
  const cached = await get(key);
  if (cached !== null) return cached;
  const fresh = await loader();
  if (fresh !== undefined && fresh !== null) {
    await set(key, fresh, ttlSeconds);
  }
  return fresh;
};

module.exports = {
  DEFAULT_TTL,
  get,
  set,
  del,
  delByPattern,
  wrap,
};
