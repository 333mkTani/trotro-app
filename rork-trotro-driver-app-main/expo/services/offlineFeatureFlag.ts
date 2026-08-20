const normalizePercent = (value: string | undefined): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(0, Math.min(100, parsed));
};

const stableBucket = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % 100;
};

export function isOfflineSyncEnabled(userId?: string): boolean {
  if (process.env.EXPO_PUBLIC_OFFLINE_SYNC_ENABLED === 'false') return false;
  const rollout = normalizePercent(process.env.EXPO_PUBLIC_OFFLINE_SYNC_ROLLOUT_PERCENT);
  if (rollout >= 100) return true;
  if (rollout <= 0 || !userId) return false;
  return stableBucket(userId) < rollout;
}

export const OFFLINE_SYNC_ROLLOUT = normalizePercent(process.env.EXPO_PUBLIC_OFFLINE_SYNC_ROLLOUT_PERCENT);

export function offlineSyncConfig(): { enabled: boolean; rolloutPercent: number } {
  return {
    enabled: process.env.EXPO_PUBLIC_OFFLINE_SYNC_ENABLED !== 'false',
    rolloutPercent: OFFLINE_SYNC_ROLLOUT,
  };
}

export function offlineSyncHashBucket(userId: string): number {
  return stableBucket(userId);
}

