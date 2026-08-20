const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
};
const mockStorage = {
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
};

jest.doMock('expo-sqlite', () => ({ openDatabaseSync: () => mockDb }));
jest.doMock('@react-native-async-storage/async-storage', () => mockStorage);
jest.doMock('@/services/api', () => ({ API_BASE_URL: 'https://example.test' }));
jest.doMock('@/store/authStore', () => ({
  useAuthStore: { getState: () => ({ accessToken: 'token', user: { id: 'driver-1' } }) },
}));

const { initializeLocalSync, migrateLegacyGpsQueue, queueMutation, getSyncStatus } = require('@/services/localSync') as typeof import('@/services/localSync');

describe('driver local sync', () => {
  beforeEach(() => jest.clearAllMocks());

  it('queues driver mutations durably and exposes pending status', async () => {
    await initializeLocalSync();
    await queueMutation({
      userId: 'driver-1',
      entity: 'driver_location',
      operation: 'update',
      payload: { lat: 5.56, lng: -0.2 },
      eventId: 'gps-event-1',
      idempotencyKey: 'gps-idem-1',
    });

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO sync_queue'),
      'driver-1', 'gps-event-1', 'gps-idem-1', expect.any(String),
      'driver_location', 'update', JSON.stringify({ lat: 5.56, lng: -0.2 }), expect.any(String),
    );
    expect(getSyncStatus()).toBe('pending');
  });

  it('imports the legacy GPS queue once and removes the old storage key', async () => {
    mockStorage.getItem
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify([{ lat: 5.56, lng: -0.2, timestamp: 123 }]));

    const imported = await migrateLegacyGpsQueue('driver-1');

    expect(imported).toBe(1);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO sync_queue'),
      'driver-1', 'legacy-gps:123:5.56:-0.2', 'legacy-gps:123:5.56:-0.2', expect.any(String),
      'driver_location', 'update', JSON.stringify({ lat: 5.56, lng: -0.2 }), expect.any(String),
    );
    expect(mockStorage.setItem).toHaveBeenCalledWith('gps_offline_queue_migrated_v1', 'true');
    expect(mockStorage.removeItem).toHaveBeenCalledWith('gps_offline_queue');
  });
});
