const { query, withTransaction } = require('../config/db');
const { ApiError } = require('../utils/ApiError');
const driverProfile = require('./driverProfile.service');

const PROCESSING_TIMEOUT_MS = 5 * 60 * 1000;
const PUBLIC_AUDIENCE = null;

const supportedMutation = (entity, operation) =>
  (entity === 'driver_location' && operation === 'update') ||
  (entity === 'driver_availability' && operation === 'set') ||
  (entity === 'driver_driving_status' && operation === 'set');

const normalizeReceipt = (row) => ({
  eventId: row.event_id,
  idempotencyKey: row.idempotency_key,
  status: row.status,
  result: row.result || {},
  errorCode: row.error_code || null,
  errorMessage: row.error_message || null,
  processedAt: row.processed_at,
});

const getExistingReceipt = async (userId, idempotencyKey, eventId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select * from public.sync_mutations
      where user_id = $1 and (idempotency_key = $2 or event_id = $3)
      order by created_at desc
      limit 1`,
    [userId, idempotencyKey, eventId],
  );
  return rows[0] || null;
};

const reserveMutation = async (client, {
  userId, deviceId, eventId, idempotencyKey, entity, operation, payload, clientCreatedAt,
}) => {
  await client.query(
    `insert into public.sync_mutations
      (user_id, device_id, event_id, idempotency_key, entity, operation, payload, client_created_at, status, result, error_code, error_message)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'processing','{}'::jsonb,null,null)
     on conflict (user_id, idempotency_key) do nothing`,
    [userId, deviceId, eventId, idempotencyKey, entity, operation, JSON.stringify(payload), clientCreatedAt],
  );
  const { rows } = await client.query(
    `select * from public.sync_mutations
      where user_id = $1 and (idempotency_key = $2 or event_id = $3)
      order by created_at desc
      limit 1
      for update`,
    [userId, idempotencyKey, eventId],
  );
  return rows[0];
};

const markMutation = async (client, id, status, {
  result = {}, errorCode = null, errorMessage = null,
} = {}) => {
  const { rows } = await client.query(
    `update public.sync_mutations
        set status = $2, result = $3::jsonb, error_code = $4, error_message = $5, processed_at = now()
      where id = $1
      returning *`,
    [id, status, JSON.stringify(result), errorCode, errorMessage],
  );
  return rows[0];
};

const appendChange = async (client, {
  audienceUserId = PUBLIC_AUDIENCE, entity, entityId, operation = 'upsert', payload,
}) => {
  const { rows } = await client.query(
    `insert into public.sync_changes
      (audience_user_id, entity, entity_id, operation, payload)
     values ($1,$2,$3,$4,$5::jsonb)
     returning sequence_id, created_at`,
    [audienceUserId, entity, entityId, operation, JSON.stringify(payload)],
  );
  return rows[0];
};

const assertDriver = (user) => {
  if (!user || !['driver', 'admin'].includes(user.role)) {
    throw ApiError.forbidden('Only drivers can submit driver sync mutations');
  }
};

const applyMutation = async (user, { entity, operation, payload }, client) => {
  if (!supportedMutation(entity, operation)) {
    throw ApiError.badRequest('Unsupported offline mutation');
  }
  assertDriver(user);

  if (entity === 'driver_location') {
    const lat = Number(payload.lat);
    const lng = Number(payload.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
      throw ApiError.badRequest('Driver location coordinates are invalid');
    }
    const applied = await driverProfile.updateLocation(
      user.id,
      { lat, lng },
      { client, deferSideEffects: true },
    );
    const updated = applied.updated;
    const result = { busId: updated.id, routeId: updated.route_id || null, lat, lng };
    return {
      result,
      change: {
        audienceUserId: user.id,
        entity: 'driver_location',
        entityId: String(updated.id),
        payload: { ...result, driverId: user.id, updatedAt: new Date().toISOString() },
      },
      sideEffects: applied.sideEffects,
    };
  }

  if (entity === 'driver_availability') {
    if (typeof payload.isAvailable !== 'boolean') throw ApiError.badRequest('isAvailable must be boolean');
    const updated = await driverProfile.setAvailability(user.id, payload.isAvailable, client);
    const result = { busId: updated.id, status: updated.status, drivingStatus: updated.driving_status };
    return {
      result,
      change: { audienceUserId: user.id, entity: 'driver_bus', entityId: String(updated.id), payload: result },
      sideEffects: null,
    };
  }

  if (typeof payload.drivingStatus !== 'string') throw ApiError.badRequest('drivingStatus is required');
  const updated = await driverProfile.setDrivingStatus(user.id, payload.drivingStatus, client);
  const result = { busId: updated.id, status: updated.status, drivingStatus: updated.driving_status };
  return {
    result,
    change: { audienceUserId: user.id, entity: 'driver_bus', entityId: String(updated.id), payload: result },
    sideEffects: null,
  };
};

const classifyMutationError = (error) => {
  if (error?.status === 409) return 'conflict';
  if (error?.status !== undefined && error.status < 500) return 'rejected';
  return 'retryable';
};

const processMutation = async (user, input) => {
  assertDriver(user);
  const existing = await getExistingReceipt(user.id, input.idempotencyKey, input.eventId);
  if (existing && (existing.idempotency_key !== input.idempotencyKey || existing.event_id !== input.eventId)) {
    throw ApiError.conflict('eventId or idempotencyKey is already associated with another mutation');
  }
  if (existing && existing.status !== 'processing') {
    return { ...normalizeReceipt(existing), status: existing.status === 'accepted' ? 'duplicate' : existing.status };
  }
  if (existing && new Date(existing.processed_at).getTime() > Date.now() - PROCESSING_TIMEOUT_MS) {
    return { ...normalizeReceipt(existing), status: 'retryable', errorCode: 'PROCESSING', errorMessage: 'Mutation is still being processed' };
  }

  let committed = null;
  try {
    committed = await withTransaction(async (client) => {
      const receipt = await reserveMutation(client, { userId: user.id, ...input });
      if (receipt.status !== 'processing') {
        const normalized = normalizeReceipt(receipt);
        return {
          receipt: {
            ...normalized,
            status: receipt.status === 'accepted' ? 'duplicate' : receipt.status,
          },
          sideEffects: null,
        };
      }

      try {
        const applied = await applyMutation(user, input, client);
        await appendChange(client, applied.change);
        const marked = await markMutation(client, receipt.id, 'accepted', { result: applied.result });
        return { receipt: normalizeReceipt(marked), sideEffects: applied.sideEffects };
      } catch (error) {
        const status = classifyMutationError(error);
        // Application-level errors can be recorded in the same transaction. A
        // database/transport failure aborts the transaction and is retried by
        // the client without leaving a misleading processing receipt behind.
        if (status === 'retryable' && error?.status === undefined) throw error;
        const marked = await markMutation(client, receipt.id, status, {
          errorCode: error.code || `HTTP_${error.status || 400}`,
          errorMessage: error.message || 'Mutation rejected',
        });
        return { receipt: normalizeReceipt(marked), sideEffects: null };
      }
    });
  } catch (error) {
    return {
      eventId: input.eventId,
      idempotencyKey: input.idempotencyKey,
      status: 'retryable',
      result: {},
      errorCode: error.code || 'SYNC_TRANSACTION_FAILED',
      errorMessage: 'Sync transaction failed; retry the mutation',
      processedAt: null,
    };
  }

  if (committed?.sideEffects) {
    try {
      await driverProfile.publishLocationSideEffects(committed.sideEffects);
    } catch (error) {
      // The database commit is authoritative; realtime delivery can be retried
      // independently and must not make a committed mutation appear failed.
      console.error('[sync] post-commit side effects failed', error);
    }
  }
  return committed.receipt;
};

const pullChanges = async (userId, { cursor = 0, limit = 100 }) => {
  const safeCursor = Number.isSafeInteger(cursor) && cursor >= 0 ? cursor : 0;
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const { rows } = await query(
    `select sequence_id, entity, entity_id, operation, payload, created_at
       from public.sync_changes
      where sequence_id > $1
        and (audience_user_id is null or audience_user_id = $2)
      order by sequence_id asc
      limit $3`,
    [safeCursor, userId, safeLimit + 1],
  );
  const hasMore = rows.length > safeLimit;
  const changes = (hasMore ? rows.slice(0, safeLimit) : rows).map((row) => ({
    sequenceId: Number(row.sequence_id),
    entity: row.entity,
    entityId: row.entity_id,
    operation: row.operation,
    payload: row.payload,
    createdAt: row.created_at,
  }));
  return {
    cursor: safeCursor,
    nextCursor: changes.length ? changes[changes.length - 1].sequenceId : safeCursor,
    hasMore,
    changes,
  };
};

module.exports = { processMutation, pullChanges, supportedMutation };
