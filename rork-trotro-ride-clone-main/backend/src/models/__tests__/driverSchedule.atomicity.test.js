jest.mock('../../config/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

const db = require('../../config/db');
const occurrenceModel = require('../scheduleOccurrence.model');

const bus = { id: 'bus-1', driver_id: 'driver-1', route_id: 'route-1', total_seats: 2 };
const occurrence = {
  id: 'occ-1', passenger_id: 'pass-1', route_id: 'route-1', status: 'offered',
  assigned_driver_id: null, boarding_start_at: '2026-08-10T08:00:00Z',
  boarding_end_at: '2026-08-10T09:00:00Z', final_acceptance_deadline: '2099-08-09T20:00:00Z',
};

describe('driver schedule atomic capacity transitions', () => {
  beforeEach(() => jest.clearAllMocks());

  it('locks the occurrence so two drivers cannot accept the same occurrence', async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ ...bus, id: 'bus-2', driver_id: 'driver-2' }] })
      .mockResolvedValueOnce({ rows: [{ ...occurrence, assigned_driver_id: 'driver-1' }] }) };
    db.withTransaction.mockImplementationOnce((fn) => fn(client));

    await expect(occurrenceModel.acceptAtomic('occ-1', 'driver-2'))
      .resolves.toEqual({ error: 'ALREADY_ASSIGNED' });
    expect(client.query.mock.calls[1][0]).toContain('for update of o');
    expect(client.query).toHaveBeenCalledTimes(2);
  });

  it('refuses acceptance when overlapping future reservations exhaust capacity', async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [bus] })
      .mockResolvedValueOnce({ rows: [occurrence] })
      .mockResolvedValueOnce({ rows: [{ reserved: 2 }] }) };
    db.withTransaction.mockImplementationOnce((fn) => fn(client));

    await expect(occurrenceModel.acceptAtomic('occ-1', 'driver-1')).resolves.toEqual({ error: 'FULL' });
    expect(client.query).toHaveBeenCalledTimes(3);
    expect(client.query.mock.calls[2][0]).toContain("fr.status = 'held'");
  });

  it('withdrawal releases held future capacity before reopening matching', async () => {
    const client = { query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ ...occurrence, assigned_driver_id: 'driver-1', boarding_opens_at: '2099-08-10T07:30:00Z' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...occurrence, status: 'offered' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }) };
    db.withTransaction.mockImplementationOnce((fn) => fn(client));

    await expect(occurrenceModel.withdrawAtomic('occ-1', 'driver-1', 'maintenance'))
      .resolves.toMatchObject({ occurrence: { status: 'offered' } });
    const releaseCall = client.query.mock.calls.find(([sql]) => sql.includes('update public.future_reservations'));
    expect(releaseCall[0]).toContain("set status = 'released'");
    expect(releaseCall[0]).toContain("status = 'held'");
  });
});
