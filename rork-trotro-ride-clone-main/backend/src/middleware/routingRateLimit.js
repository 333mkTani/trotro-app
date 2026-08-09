const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { env } = require('../config/env');
const { client: redisClient, isReady: redisReady } = require('../config/redis');

const options = {
  windowMs: env.ROUTING_RATE_LIMIT_WINDOW_MS,
  max: env.ROUTING_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  handler: (_req, res) => res.status(429).json({
    error: 'TooManyRequests',
    message: 'Too many routing requests. Please wait before trying again.',
  }),
};

if (env.REDIS_URL && redisClient) {
  options.store = new RedisStore({
    sendCommand: (...args) => {
      if (!redisReady()) throw new Error('redis not ready');
      return redisClient.call(...args);
    },
    prefix: 'rl:routing:',
  });
}

const routingRateLimit = rateLimit(options);

module.exports = { routingRateLimit };
