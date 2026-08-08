jest.mock('../../config/db', () => ({ pool: { connect: jest.fn() } }));
jest.mock('../scheduleDispatch.service', () => ({ runCycle: jest.fn() }));
jest.mock('../scheduleLifecycle.service', () => ({ runCycle: jest.fn() }));

const { pool } = require('../../config/db');
const dispatch = require('../scheduleDispatch.service');
const lifecycle = require('../scheduleLifecycle.service');
const worker = require('../scheduleWorker.service');

describe('schedule worker advisory locking', () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();
    client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
    dispatch.runCycle.mockResolvedValue({ created: 1, notifications: 0 });
    lifecycle.runCycle.mockResolvedValue({ opened: 0, noShows: 0 });
  });

  it('skips the cycle when another process holds the lock', async () => {
    client.query.mockResolvedValueOnce({ rows: [{ acquired: false }] });

    await expect(worker.runLockedCycle()).resolves.toEqual({ skipped: true, reason: 'lock_held' });
    expect(dispatch.runCycle).not.toHaveBeenCalled();
    expect(lifecycle.runCycle).not.toHaveBeenCalled();
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('runs both phases and releases an acquired lock', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });

    const result = await worker.runLockedCycle();

    expect(result.skipped).toBe(false);
    expect(dispatch.runCycle).toHaveBeenCalledTimes(1);
    expect(lifecycle.runCycle).toHaveBeenCalledTimes(1);
    expect(client.query).toHaveBeenLastCalledWith(
      'select pg_advisory_unlock($1)',
      [worker.SCHEDULE_CYCLE_LOCK_ID],
    );
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('unlocks and rethrows when a phase fails', async () => {
    client.query
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });
    dispatch.runCycle.mockRejectedValueOnce(new Error('database unavailable'));

    await expect(worker.runLockedCycle()).rejects.toThrow('database unavailable');
    expect(client.query).toHaveBeenLastCalledWith(
      'select pg_advisory_unlock($1)',
      [worker.SCHEDULE_CYCLE_LOCK_ID],
    );
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
