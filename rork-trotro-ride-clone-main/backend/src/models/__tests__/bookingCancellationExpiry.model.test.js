jest.mock('../../config/db', () => ({ query: jest.fn() }));

const model = require('../booking.model');

describe('atomic booking cancellation and expiry queries', () => {
  it('classifies timely paid cancellations for refund under a row lock', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'booking-1' }] }) };
    await model.cancelForUser('booking-1', new Date('2026-08-12T07:00:00Z'), client);
    const sql = client.query.mock.calls[0][0];
    expect(sql).toContain('for update');
    expect(sql).toContain("then 'refund_pending'::reservation_payment_status");
    expect(sql).toContain("l.status in ('pending', 'confirmed')");
    expect(sql).toContain('l.boarded_at is null');
  });

  it('sweeps only elapsed holds or confirmed unboarded deadlines', async () => {
    const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await model.expireDue(new Date('2026-08-12T09:00:00Z'), 4, client);
    const sql = client.query.mock.calls[0][0];
    expect(sql).toContain('hold_expires_at <= $1');
    expect(sql).toContain("status = 'confirmed' and boarded_at is null");
    expect(sql).toContain('for update skip locked');
    expect(sql).toContain("then 'failed'::reservation_payment_status");
  });

  it('records pickup GPS evidence only before the boarding deadline', async () => {
    const db = require('../../config/db');
    db.query.mockResolvedValueOnce({ rows: [] });
    await model.detectPickupArrivals('driver-1', { lat: 6.67, lng: -1.57, radiusM: 150 });
    const [sql, params] = db.query.mock.calls.at(-1);
    expect(sql).toContain('driver_pickup_arrived_at = coalesce');
    expect(sql).toContain('now() <= b.boarding_deadline');
    expect(sql).toContain('ST_DWithin');
    expect(params).toEqual(['driver-1', -1.57, 6.67, 150]);
  });
});
