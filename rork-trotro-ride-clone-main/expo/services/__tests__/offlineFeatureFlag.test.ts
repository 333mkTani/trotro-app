import { isOfflineSyncEnabled, offlineSyncHashBucket } from '@/services/offlineFeatureFlag';

describe('passenger offline sync feature flag', () => {
  const originalEnabled = process.env.EXPO_PUBLIC_OFFLINE_SYNC_ENABLED;
  const originalRollout = process.env.EXPO_PUBLIC_OFFLINE_SYNC_ROLLOUT_PERCENT;

  afterEach(() => {
    process.env.EXPO_PUBLIC_OFFLINE_SYNC_ENABLED = originalEnabled;
    process.env.EXPO_PUBLIC_OFFLINE_SYNC_ROLLOUT_PERCENT = originalRollout;
  });

  it('supports an emergency disable', () => {
    process.env.EXPO_PUBLIC_OFFLINE_SYNC_ENABLED = 'false';
    process.env.EXPO_PUBLIC_OFFLINE_SYNC_ROLLOUT_PERCENT = '100';
    expect(isOfflineSyncEnabled('passenger-1')).toBe(false);
  });

  it('assigns a stable user to a configured rollout cohort', () => {
    process.env.EXPO_PUBLIC_OFFLINE_SYNC_ENABLED = 'true';
    process.env.EXPO_PUBLIC_OFFLINE_SYNC_ROLLOUT_PERCENT = '100';
    const bucket = offlineSyncHashBucket('passenger-1');
    expect(isOfflineSyncEnabled('passenger-1')).toBe(true);

    process.env.EXPO_PUBLIC_OFFLINE_SYNC_ROLLOUT_PERCENT = String(bucket);
    expect(isOfflineSyncEnabled('passenger-1')).toBe(false);
  });
});
