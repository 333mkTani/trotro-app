/**
 * Socket.IO realtime layer.
 *
 * Responsibilities:
 *  - Authenticate sockets via JWT (custom or Supabase) at handshake time.
 *  - Provide room conventions for drivers, buses, routes and individual users.
 *  - Use the Redis adapter when available so events fan out across multiple
 *    Node instances behind nginx / a load balancer.
 *  - Bridge `bus:location` events to a Redis pub/sub channel so other API
 *    instances (REST endpoints, workers) can react without a direct socket.
 *
 * Room naming convention:
 *   user:<userId>     — events targeted at one user (booking updates, alerts)
 *   driver:<driverId> — events for a specific driver (assignments, payouts)
 *   bus:<busId>       — passengers tracking a particular bus
 *   route:<routeId>   — passengers watching activity on a route
 */
const http = require('http');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');

const { env } = require('../config/env');
const {
  publisher: redisPub,
  subscriber: redisSub,
  isReady: redisReady,
} = require('../config/redis');

const LOCATION_CHANNEL = 'bus:location';

let io = null;

const verifyToken = (token) => {
  if (!token) return null;
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
      return { id: payload.sub, role, email: payload.email, phone: payload.phone };
    } catch (_err) {
      // try next secret
    }
  }
  return null;
};

const extractToken = (socket) => {
  const auth = socket.handshake.auth || {};
  if (auth.token) return String(auth.token).replace(/^Bearer\s+/i, '');
  const header = socket.handshake.headers?.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const q = socket.handshake.query?.token;
  if (typeof q === 'string') return q;
  return null;
};

/**
 * Attach Socket.IO to an existing http.Server. Returns the io instance.
 * @param {http.Server} server
 */
const attach = (server) => {
  if (!(server instanceof http.Server)) {
    throw new Error('attach(server): expected an http.Server');
  }

  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 20000,
    maxHttpBufferSize: 1e6,
  });

  // Multi-instance fan-out via Redis adapter.
  if (env.REDIS_URL && redisPub && redisSub) {
    try {
      io.adapter(createAdapter(redisPub, redisSub));
      console.log('[socket.io] redis adapter enabled');
    } catch (err) {
      console.error('[socket.io] failed to enable redis adapter', err.message);
    }
  } else {
    console.warn('[socket.io] running in single-instance mode (no redis adapter)');
  }

  // JWT authentication at handshake.
  io.use((socket, next) => {
    const token = extractToken(socket);
    const user = verifyToken(token);
    if (!user || !user.id) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user.id}`);
    if (user.role === 'driver') socket.join(`driver:${user.id}`);

    socket.on('subscribe:bus', (busId) => {
      if (typeof busId === 'string' && busId) socket.join(`bus:${busId}`);
    });
    socket.on('unsubscribe:bus', (busId) => {
      if (typeof busId === 'string' && busId) socket.leave(`bus:${busId}`);
    });
    socket.on('subscribe:route', (routeId) => {
      if (typeof routeId === 'string' && routeId) socket.join(`route:${routeId}`);
    });
    socket.on('unsubscribe:route', (routeId) => {
      if (typeof routeId === 'string' && routeId) socket.leave(`route:${routeId}`);
    });

    /**
     * Drivers stream their bus location. We re-broadcast to bus and route
     * rooms, and publish on Redis so other services can persist / analyze.
     * Payload: { busId, routeId?, lat, lng, heading?, speed?, ts? }
     */
    socket.on('bus:location', async (payload, ack) => {
      if (user.role !== 'driver' && user.role !== 'admin') {
        if (typeof ack === 'function') ack({ ok: false, error: 'forbidden' });
        return;
      }
      const { busId, routeId, lat, lng } = payload || {};
      if (
        typeof busId !== 'string' ||
        typeof lat !== 'number' ||
        typeof lng !== 'number' ||
        Number.isNaN(lat) ||
        Number.isNaN(lng)
      ) {
        if (typeof ack === 'function') ack({ ok: false, error: 'invalid_payload' });
        return;
      }
      const event = {
        busId,
        routeId: typeof routeId === 'string' ? routeId : null,
        lat,
        lng,
        heading: typeof payload.heading === 'number' ? payload.heading : null,
        speed: typeof payload.speed === 'number' ? payload.speed : null,
        driverId: user.id,
        ts: typeof payload.ts === 'number' ? payload.ts : Date.now(),
      };
      io.to(`bus:${busId}`).emit('bus:location', event);
      if (event.routeId) io.to(`route:${event.routeId}`).emit('bus:location', event);

      if (redisReady() && redisPub) {
        try {
          await redisPub.publish(LOCATION_CHANNEL, JSON.stringify(event));
        } catch (err) {
          console.error('[socket.io] publish bus:location failed', err.message);
        }
      }
      if (typeof ack === 'function') ack({ ok: true });
    });

    socket.on('disconnect', () => {
      // No-op for now; rooms are cleaned up automatically.
    });
  });

  return io;
};

const getIO = () => {
  if (!io) throw new Error('socket.io not initialized — call attach(server) first');
  return io;
};

/** Server-side helpers for the rest of the app to push events. */
const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
};
const emitToDriver = (driverId, event, payload) => {
  if (!io || !driverId) return;
  io.to(`driver:${driverId}`).emit(event, payload);
};
const emitToBus = (busId, event, payload) => {
  if (!io || !busId) return;
  io.to(`bus:${busId}`).emit(event, payload);
};
const emitToRoute = (routeId, event, payload) => {
  if (!io || !routeId) return;
  io.to(`route:${routeId}`).emit(event, payload);
};

module.exports = {
  attach,
  getIO,
  emitToUser,
  emitToDriver,
  emitToBus,
  emitToRoute,
  LOCATION_CHANNEL,
};
