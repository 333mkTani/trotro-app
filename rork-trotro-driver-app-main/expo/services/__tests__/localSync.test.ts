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

const { initializeLocalSync, migrateLegacyGpsQueue, purgeLocalSync, queueDriverAvailability, queueDriverDrivingStatus, queueMutation, getSyncStatus } = require('@/services/localSync') as typeof import('@/services/localSync');

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

  it('queues safe availability and driving-status intents with backend-supported entities', async () => {
    await queueDriverAvailability('driver-1', true);
    await queueDriverDrivingStatus('driver-1', 'EN_ROUTE');

    const inserts = mockDb.runAsync.mock.calls.filter(([query]) => String(query).includes('INSERT OR IGNORE INTO sync_queue'));
    expect(inserts).toEqual(expect.arrayContaining([
      expect.arrayContaining(['driver-1', expect.any(String), expect.any(String), expect.any(String), 'driver_availability', 'set', JSON.stringify({ isAvailable: true }), expect.any(String)]),
      expect.arrayContaining(['driver-1', expect.any(String), expect.any(String), expect.any(String), 'driver_driving_status', 'set', JSON.stringify({ drivingStatus: 'EN_ROUTE' }), expect.any(String)]),
    ]));
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

  it('purges expired cache records and rejected mutations only for the current driver', async () => {
    await purgeLocalSync('driver-1', new Date('2026-08-20T00:00:00.000Z'));

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM sync_cache WHERE user_id = ? AND updated_at < ?',
      'driver-1',
      '2026-07-21T00:00:00.000Z',
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'rejected'"),
      'driver-1',
      '2026-05-22T00:00:00.000Z',
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("entity = 'driver_location'"),
      'driver-1',
      '2026-08-19T23:45:00.000Z',
    );
  });
});
