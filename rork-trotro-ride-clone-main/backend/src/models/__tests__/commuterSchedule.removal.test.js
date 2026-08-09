jest.mock('../../config/db', () => ({ query: jest.fn() }));

const model = require('../commuterSchedule.model');

describe('commuter schedule removal', () => {
  it('cancels future occurrences and releases accepted capacity atomically', async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ id: 'schedule-1', status: 'deleted' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'occ-1', assigned_driver_id: 'driver-1' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }) };

    await expect(model.removeAndCancelFuture(
      'schedule-1', 'passenger-1', new Date('2026-08-09T12:00:00Z'), client,
    )).resolves.toMatchObject({ occurrences: [{ id: 'occ-1' }] });

    expect(client.query.mock.calls[1][0]).toContain("status in ('pending','offered','accepted')");
    expect(client.query.mock.calls[2][0]).toContain("set status = 'cancelled'");
    expect(client.query.mock.calls[2][0]).toContain("status = 'held'");
    expect(client.query.mock.calls[3][0]).toContain('schedule_boarding_codes');
  });
});
