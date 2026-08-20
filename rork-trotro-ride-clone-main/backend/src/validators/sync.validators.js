const { z } = require('zod');

const SyncMutationSchema = z.object({
  eventId: z.string().min(1).max(160),
  idempotencyKey: z.string().min(8).max(160).regex(/^[A-Za-z0-9:_-]+$/),
  deviceId: z.string().min(1).max(160),
  entity: z.string().min(1).max(80),
  operation: z.string().min(1).max(80),
  payload: z.record(z.unknown()).default({}),
  clientCreatedAt: z.string().datetime({ offset: true }),
});

const SyncPullSchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

module.exports = { SyncMutationSchema, SyncPullSchema };
