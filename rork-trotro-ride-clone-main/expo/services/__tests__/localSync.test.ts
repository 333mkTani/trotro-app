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

const { initializeLocalSync, purgeLocalSync, queueMutation, getSyncStatus } = require('@/services/localSync') as typeof import('@/services/localSync');

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

  it('purges expired cache records and rejected mutations only for the current user', async () => {
    await purgeLocalSync('passenger-1', new Date('2026-08-20T00:00:00.000Z'));

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      'DELETE FROM sync_cache WHERE user_id = ? AND updated_at < ?',
      'passenger-1',
      '2026-07-21T00:00:00.000Z',
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("status = 'rejected'"),
      'passenger-1',
      '2026-05-22T00:00:00.000Z',
    );
  });
});
