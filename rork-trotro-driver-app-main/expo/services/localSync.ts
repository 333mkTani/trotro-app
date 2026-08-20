import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { API_BASE_URL } from '@/services/api';
import { useAuthStore } from '@/store/authStore';

export type SyncStatus = 'offline' | 'stale' | 'pending' | 'syncing' | 'synced' | 'conflict';
export type MutationState = 'pending' | 'conflict' | 'rejected';

type QueuedMutation = {
  id: number;
  userId: string;
  eventId: string;
  idempotencyKey: string;
  deviceId: string;
  entity: string;
  operation: string;
  payload: Record<string, unknown>;
  clientCreatedAt: string;
  attempts: number;
  status: MutationState;
  lastError: string | null;
};

type SyncChange = {
  sequenceId: number;
  entity: string;
  entityId: string;
  operation: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  createdAt: string;
};

type SyncListener = (status: SyncStatus) => void;

const DB_NAME = 'trotro-offline.db';
const DEVICE_KEY = 'offline_sync_device_id';
const LEGACY_GPS_KEY = 'gps_offline_queue';
const LEGACY_MIGRATED_KEY = 'gps_offline_queue_migrated_v1';
const SCHEMA_VERSION = 1;
const MAX_ATTEMPTS = 6;
const db: SQLiteDatabase = openDatabaseSync(DB_NAME);
let initialized = false;
let syncing = false;
let status: SyncStatus = 'stale';
const listeners = new Set<SyncListener>();

const notify = (next: SyncStatus) => {
  status = next;
  listeners.forEach((listener) => listener(next));
};

const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export async function initializeLocalSync(): Promise<void> {
  if (initialized) return;
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      event_id TEXT NOT NULL UNIQUE,
      idempotency_key TEXT NOT NULL UNIQUE,
      device_id TEXT NOT NULL,
      entity TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      client_created_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS sync_queue_ready_idx ON sync_queue(user_id, status, id, created_at);
    CREATE TABLE IF NOT EXISTS sync_cache (
      user_id TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL DEFAULT 'upsert',
      payload TEXT NOT NULL,
      server_sequence INTEGER,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, entity, entity_id)
    );
  `);
  const version = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', 'schema_version');
  if (!version) await db.runAsync('INSERT INTO sync_meta (key, value) VALUES (?, ?)', 'schema_version', String(SCHEMA_VERSION));
  initialized = true;
}

export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const created = randomId();
  await AsyncStorage.setItem(DEVICE_KEY, created);
  return created;
}

export function subscribeSyncStatus(listener: SyncListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export async function queueMutation(input: {
  userId: string;
  entity: string;
  operation: string;
  payload: Record<string, unknown>;
  eventId?: string;
  idempotencyKey?: string;
}): Promise<string> {
  await initializeLocalSync();
  const eventId = input.eventId ?? randomId();
  const idempotencyKey = input.idempotencyKey ?? `${input.entity}:${eventId}`;
  const deviceId = await getDeviceId();
  await db.runAsync(
    `INSERT OR IGNORE INTO sync_queue
      (user_id, event_id, idempotency_key, device_id, entity, operation, payload, client_created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    input.userId,
    eventId,
    idempotencyKey,
    deviceId,
    input.entity,
    input.operation,
    JSON.stringify(input.payload),
    new Date().toISOString(),
  );
  notify('pending');
  return eventId;
}

async function listQueuedMutations(userId: string): Promise<QueuedMutation[]> {
  await initializeLocalSync();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM sync_queue WHERE user_id = ? AND status IN ('pending', 'conflict') ORDER BY id ASC LIMIT 100`,
    userId,
  );
  return rows.map((row) => ({
    id: Number(row.id),
    userId: String(row.user_id),
    eventId: String(row.event_id),
    idempotencyKey: String(row.idempotency_key),
    deviceId: String(row.device_id),
    entity: String(row.entity),
    operation: String(row.operation),
    payload: JSON.parse(String(row.payload)) as Record<string, unknown>,
    clientCreatedAt: String(row.client_created_at),
    attempts: Number(row.attempts),
    status: String(row.status) as MutationState,
    lastError: row.last_error ? String(row.last_error) : null,
  }));
}

async function markMutation(id: number, nextStatus: MutationState, error?: string): Promise<void> {
  await db.runAsync('UPDATE sync_queue SET status = ?, attempts = attempts + 1, last_error = ? WHERE id = ?', nextStatus, error ?? null, id);
}

async function removeMutation(id: number): Promise<void> {
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
}

async function request(path: string, init: RequestInit): Promise<Response> {
  const token = useAuthStore.getState().accessToken;
  if (!token) throw new Error('Authentication is required to synchronize offline data.');
  return fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

async function getCursor(userId: string): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_meta WHERE key = ?', `cursor:${userId}`);
  return row ? Math.max(0, Number(row.value) || 0) : 0;
}

async function setCursor(userId: string, cursor: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    `cursor:${userId}`,
    String(cursor),
  );
}

async function applyChanges(userId: string, changes: SyncChange[]): Promise<void> {
  for (const change of changes) {
    await db.runAsync(
      `INSERT INTO sync_cache (user_id, entity, entity_id, operation, payload, server_sequence, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, entity, entity_id) DO UPDATE SET
         operation = excluded.operation, payload = excluded.payload,
         server_sequence = excluded.server_sequence, updated_at = excluded.updated_at`,
      userId,
      change.entity,
      change.entityId,
      change.operation,
      JSON.stringify(change.payload),
      change.sequenceId,
      change.createdAt,
    );
  }
}

export async function migrateLegacyGpsQueue(userId: string): Promise<number> {
  await initializeLocalSync();
  if (await AsyncStorage.getItem(LEGACY_MIGRATED_KEY)) return 0;
  const raw = await AsyncStorage.getItem(LEGACY_GPS_KEY);
  const legacy = raw ? (JSON.parse(raw) as { lat: number; lng: number; timestamp: number }[]) : [];
  let imported = 0;
  for (const point of legacy) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
    await queueMutation({
      userId,
      entity: 'driver_location',
      operation: 'update',
      payload: { lat: point.lat, lng: point.lng },
      eventId: `legacy-gps:${point.timestamp}:${point.lat}:${point.lng}`,
      idempotencyKey: `legacy-gps:${point.timestamp}:${point.lat}:${point.lng}`,
    });
    imported += 1;
  }
  await AsyncStorage.setItem(LEGACY_MIGRATED_KEY, 'true');
  await AsyncStorage.removeItem(LEGACY_GPS_KEY);
  return imported;
}

export async function syncNow(userId: string): Promise<SyncStatus> {
  await initializeLocalSync();
  await purgeLocalSync(userId);
  if (syncing) return status;
  syncing = true;
  notify('syncing');
  try {
    const queued = await listQueuedMutations(userId);
    for (const mutation of queued) {
      if (mutation.attempts >= MAX_ATTEMPTS) {
        await markMutation(mutation.id, 'conflict', 'Retry limit reached; manual review required.');
        notify('conflict');
        continue;
      }
      const response = await request('/sync/mutations', {
        method: 'POST',
        body: JSON.stringify({
          eventId: mutation.eventId,
          idempotencyKey: mutation.idempotencyKey,
          deviceId: mutation.deviceId,
          entity: mutation.entity,
          operation: mutation.operation,
          payload: mutation.payload,
          clientCreatedAt: mutation.clientCreatedAt,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok && ['accepted', 'duplicate'].includes(body.status)) {
        await removeMutation(mutation.id);
        continue;
      }
      if (response.status === 401) throw new Error('Authentication expired; sign in again to synchronize.');
      if (response.status === 409 || body.status === 'conflict') {
        await markMutation(mutation.id, 'conflict', body.errorMessage || body.message || 'Server state conflict.');
        notify('conflict');
        continue;
      }
      if (response.status >= 400 && response.status < 500) {
        await markMutation(mutation.id, 'rejected', body.errorMessage || body.message || 'Mutation was rejected.');
        continue;
      }
      await markMutation(mutation.id, 'pending', body.errorMessage || body.message || `Sync failed with HTTP ${response.status}.`);
      notify('pending');
      return status;
    }

    let cursor = await getCursor(userId);
    let hasMore = true;
    while (hasMore) {
      const response = await request(`/sync/changes?cursor=${cursor}&limit=100`, { method: 'GET' });
      if (!response.ok) {
        if (response.status === 401) throw new Error('Authentication expired; sign in again to synchronize.');
        notify('stale');
        return status;
      }
      const body = await response.json() as { nextCursor: number; hasMore: boolean; changes: SyncChange[] };
      await applyChanges(userId, body.changes || []);
      cursor = Number(body.nextCursor) || cursor;
      await setCursor(userId, cursor);
      hasMore = body.hasMore === true;
    }
    const remaining = await listQueuedMutations(userId);
    notify(remaining.some((item) => item.status === 'conflict') ? 'conflict' : remaining.length ? 'pending' : 'synced');
    return status;
  } catch (error) {
    notify(status === 'syncing' ? 'stale' : status);
    throw error;
  } finally {
    syncing = false;
  }
}

export async function getCachedRecords(userId: string, entity: string): Promise<Record<string, unknown>[]> {
  await initializeLocalSync();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT entity_id, operation, payload, server_sequence, updated_at FROM sync_cache WHERE user_id = ? AND entity = ? ORDER BY updated_at DESC`,
    userId,
    entity,
  );
  return rows.map((row) => ({
    id: String(row.entity_id),
    operation: String(row.operation),
    payload: JSON.parse(String(row.payload)),
    serverSequence: Number(row.server_sequence),
    updatedAt: String(row.updated_at),
  }));
}

export async function purgeLocalSync(userId: string, now = new Date()): Promise<void> {
  await initializeLocalSync();
  const cacheCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const failedMutationCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  await db.runAsync('DELETE FROM sync_cache WHERE user_id = ? AND updated_at < ?', userId, cacheCutoff);
  await db.runAsync(
    `DELETE FROM sync_queue WHERE user_id = ? AND status = 'rejected' AND created_at < ?`,
    userId,
    failedMutationCutoff,
  );
}

export async function clearLocalSync(userId: string): Promise<void> {
  await initializeLocalSync();
  await db.runAsync('DELETE FROM sync_queue WHERE user_id = ?', userId);
  await db.runAsync('DELETE FROM sync_cache WHERE user_id = ?', userId);
  await db.runAsync('DELETE FROM sync_meta WHERE key = ?', `cursor:${userId}`);
  await AsyncStorage.removeItem(LEGACY_GPS_KEY);
}
