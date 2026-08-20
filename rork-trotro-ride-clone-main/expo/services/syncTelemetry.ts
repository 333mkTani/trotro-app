export type SyncMetricEvent =
  | 'queue_mutation'
  | 'sync_start'
  | 'sync_success'
  | 'sync_error'
  | 'mutation_accepted'
  | 'mutation_duplicate'
  | 'mutation_conflict'
  | 'mutation_rejected';

export type SyncMetrics = {
  queued: number;
  accepted: number;
  duplicates: number;
  conflicts: number;
  rejected: number;
  syncAttempts: number;
  syncSuccesses: number;
  syncErrors: number;
  lastSyncAt: string | null;
  lastError: string | null;
};

const metrics: SyncMetrics = {
  queued: 0,
  accepted: 0,
  duplicates: 0,
  conflicts: 0,
  rejected: 0,
  syncAttempts: 0,
  syncSuccesses: 0,
  syncErrors: 0,
  lastSyncAt: null,
  lastError: null,
};

export function recordSyncMetric(event: SyncMetricEvent, error?: string): void {
  if (event === 'queue_mutation') metrics.queued += 1;
  if (event === 'mutation_accepted') metrics.accepted += 1;
  if (event === 'mutation_duplicate') metrics.duplicates += 1;
  if (event === 'mutation_conflict') metrics.conflicts += 1;
  if (event === 'mutation_rejected') metrics.rejected += 1;
  if (event === 'sync_start') metrics.syncAttempts += 1;
  if (event === 'sync_success') {
    metrics.syncSuccesses += 1;
    metrics.lastSyncAt = new Date().toISOString();
  }
  if (event === 'sync_error') {
    metrics.syncErrors += 1;
    metrics.lastError = error ?? 'sync_error';
  }
}

export function getSyncMetrics(): SyncMetrics {
  return { ...metrics };
}

export function resetSyncMetrics(): void {
  Object.assign(metrics, {
    queued: 0,
    accepted: 0,
    duplicates: 0,
    conflicts: 0,
    rejected: 0,
    syncAttempts: 0,
    syncSuccesses: 0,
    syncErrors: 0,
    lastSyncAt: null,
    lastError: null,
  });
}
