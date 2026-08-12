jest.mock('../../models/adminDashboard.model');
jest.mock('../../models/route.model');
jest.mock('../cache.service');

const model = require('../../models/adminDashboard.model');
const cache = require('../cache.service');
const service = require('../adminDashboard.service');

beforeEach(() => {
  jest.clearAllMocks();
  cache.wrap.mockImplementation((_key, _ttl, loader) => loader());
});

const stubOverview = (overrides = {}) => {
  model.bookingStatusBreakdown.mockResolvedValue(overrides.bookingStatus ?? [
    { status: 'completed', total: 8, today: 2 },
    { status: 'cancelled', total: 2, today: 1 },
  ]);
  model.paymentStatusBreakdown.mockResolvedValue([{ payment_status: 'fully_paid', total: 8 }]);
  model.paymentTotals.mockResolvedValue({
    gross_collected: '120.00', collected_today: '30.00', deposits_collected: '40.00',
    balances_collected: '80.00', refunded: '20.00', no_show_compensation: '5.00',
    ...overrides.payments,
  });
  model.paymentsInFlight.mockResolvedValue({
    pending_payments: 3, pending_amount: '15.00', pending_refunds: 1,
  });
  model.depositsHeld.mockResolvedValue({ amount: '12.50', bookings: 5 });
  model.fleetTotals.mockResolvedValue({ total: 4, active: 3, online: 2 });
  model.peopleTotals.mockResolvedValue({ passengers: 40, drivers: 6, admins: 1, joined_today: 2 });
  model.routeTotals.mockResolvedValue({ total: 5, active: 4, paused: 1, archived: 0 });
  model.walletFloat.mockResolvedValue({ total: '90.00', drivers: '60.00', passengers: '30.00' });
  model.recentBookings.mockResolvedValue([]);
};

describe('admin overview', () => {
  it('nets refunds off gross and coerces pg numerics to numbers', async () => {
    stubOverview();
    const result = await service.overview();
    expect(result.revenue.grossCollected).toBe(120);
    expect(result.revenue.refunded).toBe(20);
    expect(result.revenue.netCollected).toBe(100);
    expect(result.revenue.depositsHeld).toBe(12.5);
    expect(result.wallets.total).toBe(90);
  });

  it('totals bookings across every status bucket', async () => {
    stubOverview();
    const result = await service.overview();
    expect(result.bookings.total).toBe(10);
    expect(result.bookings.today).toBe(3);
  });

  it('reports zero rather than NaN on an empty database', async () => {
    stubOverview({
      bookingStatus: [],
      payments: {
        gross_collected: null, collected_today: null, deposits_collected: null,
        balances_collected: null, refunded: null, no_show_compensation: null,
      },
    });
    const result = await service.overview();
    expect(result.bookings.total).toBe(0);
    expect(result.revenue.grossCollected).toBe(0);
    expect(result.revenue.netCollected).toBe(0);
  });
});

describe('admin series', () => {
  it('merges the revenue and booking series by day', async () => {
    model.revenueSeries.mockResolvedValue([
      { day: '2026-08-11', deposits: '2.00', balances: '8.00', refunds: '0', payments: 2 },
      { day: '2026-08-12', deposits: '0', balances: '0', refunds: '0', payments: 0 },
    ]);
    model.bookingSeries.mockResolvedValue([
      { day: '2026-08-11', created: 3, completed: 2, cancelled: 1, expired: 0 },
    ]);
    const result = await service.series(2);
    expect(result.points[0]).toMatchObject({ day: '2026-08-11', gross: 10, bookingsCreated: 3 });
    // A day with no bookings row must still appear, zeroed rather than undefined.
    expect(result.points[1]).toMatchObject({ day: '2026-08-12', gross: 0, bookingsCreated: 0 });
  });
});

describe('admin bookings', () => {
  it('paginates and flags whether more rows remain', async () => {
    model.listBookings.mockResolvedValue({
      rows: [{ id: 'b1', total_fare: '10.00', deposit_amount: '2.00', remaining_balance: '8.00' }],
      total: 12,
    });
    const result = await service.listBookings({ limit: 1, offset: 0 });
    expect(result.bookings[0].total_fare).toBe(10);
    expect(result.hasMore).toBe(true);
    expect(result.total).toBe(12);
  });

  it('stops asking for more once the last page is reached', async () => {
    model.listBookings.mockResolvedValue({ rows: [{ id: 'b12' }], total: 12 });
    const result = await service.listBookings({ limit: 1, offset: 11 });
    expect(result.hasMore).toBe(false);
  });
});

describe('admin fleet', () => {
  it('labels GPS freshness from the last ping age', async () => {
    model.listFleet.mockResolvedValue([
      { id: 'bus-1', last_ping_at: '2026-08-12T10:00:00Z', location_age_seconds: 20 },
      { id: 'bus-2', last_ping_at: '2026-08-12T09:00:00Z', location_age_seconds: 3600 },
      { id: 'bus-3', last_ping_at: null, location_age_seconds: null },
    ]);
    const rows = await service.fleet();
    expect(rows.map((row) => row.location_status)).toEqual(['live', 'stale', 'offline']);
  });
});
