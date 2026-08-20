const mockDb = {
  execAsync: jest.fn().mockResolvedValue(undefined),
  getFirstAsync: jest.fn().mockResolvedValue(undefined),
  runAsync: jest.fn().mockResolvedValue({ changes: 1 }),
  getAllAsync: jest.fn().mockResolvedValue([]),
};

jest.doMock('expo-sqlite', () => ({ openDatabaseSync: () => mockDb }));
jest.doMock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.doMock('@/services/api', () => ({
  API_BASE_URL: 'https://example.test',
  getAuthToken: jest.fn().mockResolvedValue('token'),
}));

const { initializeLocalSync, queueMutation, getSyncStatus } = require('@/services/localSync') as typeof import('@/services/localSync');

describe('passenger local sync', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates the durable local schema before queueing a mutation', async () => {
    await initializeLocalSync();
    await queueMutation({
      userId: 'passenger-1',
      entity: 'draft_trip',
      operation: 'upsert',
      payload: { routeId: 'route-1' },
      eventId: 'event-1',
      idempotencyKey: 'draft:event-1',
    });

    expect(mockDb.execAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS sync_queue'));
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT OR IGNORE INTO sync_queue'),
      'passenger-1', 'event-1', 'draft:event-1', expect.any(String),
      'draft_trip', 'upsert', JSON.stringify({ routeId: 'route-1' }), expect.any(String),
    );
    expect(getSyncStatus()).toBe('pending');
  });
});
