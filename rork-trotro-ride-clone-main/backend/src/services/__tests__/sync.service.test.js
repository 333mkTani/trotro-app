jest.mock('../../config/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock('../driverProfile.service', () => ({
  updateLocation: jest.fn(),
  setAvailability: jest.fn(),
  setDrivingStatus: jest.fn(),
  publishLocationSideEffects: jest.fn(),
}));

const { query, withTransaction } = require('../../config/db');
const driverProfile = require('../driverProfile.service');
const syncService = require('../sync.service');

const driver = { id: 'driver-1', role: 'driver' };
const baseInput = {
  eventId: 'event-123',
  idempotencyKey: 'idem-12345',
  deviceId: 'device-1',
  entity: 'driver_availability',
  operation: 'set',
  payload: { isAvailable: true },
  clientCreatedAt: '2026-08-20T12:00:00.000Z',
};

const processingReceipt = {
  id: 'receipt-1',
  status: 'processing',
  event_id: baseInput.eventId,
  idempotency_key: baseInput.idempotencyKey,
  result: {},
  processed_at: new Date().toISOString(),
};

const acceptedReceipt = {
  ...processingReceipt,
  status: 'accepted',
  result: { busId: 'bus-1', status: 'active', drivingStatus: 'STATIONARY' },
  processed_at: '2026-08-20T12:00:01.000Z',
};

let transactionClient;

beforeEach(() => {
  jest.resetAllMocks();
  query.mockResolvedValue({ rows: [] });
  transactionClient = { query: jest.fn() };
  withTransaction.mockImplementation(async (fn) => fn(transactionClient));
});

describe('processMutation', () => {
  test('accepts a driver availability mutation and atomically records its change', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    transactionClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [processingReceipt] })
      .mockResolvedValueOnce({ rows: [{ sequence_id: '9', created_at: '2026-08-20T12:00:01.000Z' }] })
      .mockResolvedValueOnce({ rows: [acceptedReceipt] });
    driverProfile.setAvailability.mockResolvedValue({ id: 'bus-1', status: 'active', driving_status: 'STATIONARY' });

    const result = await syncService.processMutation(driver, baseInput);

    expect(result.status).toBe('accepted');
    expect(result.result.busId).toBe('bus-1');
    expect(driverProfile.setAvailability).toHaveBeenCalledWith('driver-1', true, transactionClient);
    expect(transactionClient.query).toHaveBeenCalledTimes(4);
  });

  test('returns duplicate without applying a previously accepted mutation', async () => {
    query.mockResolvedValueOnce({ rows: [acceptedReceipt] });

    const result = await syncService.processMutation(driver, baseInput);

    expect(result.status).toBe('duplicate');
    expect(result.result).toEqual(acceptedReceipt.result);
    expect(driverProfile.setAvailability).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('rejects an event id reused for a different idempotency key', async () => {
    query.mockResolvedValueOnce({ rows: [{
      ...acceptedReceipt,
      idempotency_key: 'different-key',
    }] });
    await expect(syncService.processMutation(driver, baseInput)).rejects.toMatchObject({ status: 409 });
  });

  test('rejects non-driver mutations before applying them', async () => {
    await expect(syncService.processMutation({ id: 'passenger-1', role: 'passenger' }, baseInput))
      .rejects.toMatchObject({ status: 403 });
  });

  test('returns a retryable response while an identical mutation is processing', async () => {
    query.mockResolvedValueOnce({ rows: [processingReceipt] });

    const result = await syncService.processMutation(driver, baseInput);

    expect(result.status).toBe('retryable');
    expect(driverProfile.setAvailability).not.toHaveBeenCalled();
    expect(withTransaction).not.toHaveBeenCalled();
  });

  test('returns retryable without a receipt when the transaction fails', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    withTransaction.mockRejectedValueOnce(Object.assign(new Error('database unavailable'), { code: 'ECONNRESET' }));

    const result = await syncService.processMutation(driver, baseInput);

    expect(result).toMatchObject({ status: 'retryable', errorCode: 'ECONNRESET' });
  });

  test('records a rejected application error in the same transaction', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    transactionClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [processingReceipt] })
      .mockResolvedValueOnce({ rows: [{ ...processingReceipt, status: 'rejected', error_code: 'HTTP_400', error_message: 'invalid' }] });
    driverProfile.setAvailability.mockRejectedValueOnce(Object.assign(new Error('invalid'), { status: 400 }));

    const result = await syncService.processMutation(driver, baseInput);

    expect(result.status).toBe('rejected');
    expect(transactionClient.query).toHaveBeenCalledTimes(3);
  });
});

describe('pullChanges', () => {
  test('returns an ordered page and advances the cursor to the last change', async () => {
    query.mockResolvedValueOnce({ rows: [
      { sequence_id: '5', entity: 'driver_bus', entity_id: 'bus-1', operation: 'upsert', payload: { status: 'active' }, created_at: '2026-08-20T12:00:00.000Z' },
      { sequence_id: '6', entity: 'driver_location', entity_id: 'bus-1', operation: 'upsert', payload: { lat: 5.6, lng: -0.2 }, created_at: '2026-08-20T12:00:01.000Z' },
    ] });

    const result = await syncService.pullChanges('driver-1', { cursor: 4, limit: 10 });

    expect(result).toMatchObject({ cursor: 4, nextCursor: 6, hasMore: false });
    expect(result.changes).toHaveLength(2);
    expect(result.changes[0].sequenceId).toBe(5);
  });

  test('caps the requested page size and preserves an empty cursor', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const result = await syncService.pullChanges('driver-1', { cursor: -10, limit: 1000 });

    expect(result).toMatchObject({ cursor: 0, nextCursor: 0, hasMore: false, changes: [] });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('limit $3'), [0, 'driver-1', 101]);
  });
});
