/**
 * Redis 7+ client (ioredis).
 *
 * - Lazy connect so the API still boots if Redis is unreachable.
 * - Falls back to a no-op stub when REDIS_URL is empty, keeping local
 *   dev frictionless (cache becomes a passthrough).
 * - Exposes a separate pub/sub publisher and subscriber pair, since a
 *   subscribed connection cannot run normal commands.
 */
const Redis = require('ioredis');
const { env } = require('./env');

let client = null;
let publisher = null;
let subscriber = null;
let connected = false;

const buildClient = (label) => {
  const c = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    reconnectOnError: () => true,
    retryStrategy: (times) => Math.min(times * 200, 2000),
  });
  c.on('error', (err) => {
    if (connected) console.error(`[redis:${label}] error`, err.message);
  });
  c.on('ready', () => {
    connected = true;
    console.log(`[redis:${label}] ready`);
  });
  c.on('end', () => {
    connected = false;
  });
  return c;
};

if (env.REDIS_URL) {
  client = buildClient('main');
  publisher = buildClient('pub');
  subscriber = buildClient('sub');
  // Best-effort connect; failures are logged via the 'error' handler.
  client.connect().catch(() => {});
  publisher.connect().catch(() => {});
  subscriber.connect().catch(() => {});
} else {
  console.warn('[redis] REDIS_URL not set — cache + pub/sub disabled');
}

const isReady = () => Boolean(client && client.status === 'ready');

const safeCall = async (fn, fallback = null) => {
  if (!isReady()) return fallback;
  try {
    return await fn();
  } catch (err) {
    console.error('[redis] op failed', err.message);
    return fallback;
  }
};

const closeAll = async () => {
  for (const c of [client, publisher, subscriber]) {
    if (!c) continue;
    try { await c.quit(); } catch (_) {}
  }
};

module.exports = {
  client,
  publisher,
  subscriber,
  isReady,
  safeCall,
  closeAll,
};
