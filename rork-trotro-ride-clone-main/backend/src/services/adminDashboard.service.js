const model = require('../models/adminDashboard.model');
const routeModel = require('../models/route.model');
const cache = require('./cache.service');

const OVERVIEW_KEY = 'admin:overview';
const OVERVIEW_TTL = 15;
const SERIES_KEY = (days) => `admin:series:${days}`;
const SERIES_TTL = 300;
const ROUTE_PERF_KEY = (days) => `admin:route-performance:${days}`;
const ROUTE_PERF_TTL = 300;

/** pg returns numeric as text; the dashboard wants real numbers. */
const num = (value) => (value == null ? 0 : Number(value));

const mapNumbers = (row, keys) => {
  const out = { ...row };
  for (const key of keys) out[key] = num(row[key]);
  return out;
};

const overview = () => cache.wrap(OVERVIEW_KEY, OVERVIEW_TTL, async () => {
  const [
    bookingStatus, paymentStatus, payments, inFlight, deposits,
    fleet, people, routes, wallet, recent,
  ] = await Promise.all([
    model.bookingStatusBreakdown(),
    model.paymentStatusBreakdown(),
    model.paymentTotals(),
    model.paymentsInFlight(),
    model.depositsHeld(),
    model.fleetTotals(),
    model.peopleTotals(),
    model.routeTotals(),
    model.walletFloat(),
    model.recentBookings(8),
  ]);

  const bookingsTotal = bookingStatus.reduce((sum, row) => sum + row.total, 0);
  const bookingsToday = bookingStatus.reduce((sum, row) => sum + row.today, 0);
  const gross = num(payments.gross_collected);
  const refunded = num(payments.refunded);

  return {
    generatedAt: new Date().toISOString(),
    bookings: {
      total: bookingsTotal,
      today: bookingsToday,
      byStatus: bookingStatus,
      byPaymentStatus: paymentStatus,
    },
    revenue: {
      grossCollected: gross,
      collectedToday: num(payments.collected_today),
      depositsCollected: num(payments.deposits_collected),
      balancesCollected: num(payments.balances_collected),
      refunded,
      noShowCompensation: num(payments.no_show_compensation),
      netCollected: Number((gross - refunded).toFixed(2)),
      depositsHeld: num(deposits.amount),
      depositsHeldBookings: deposits.bookings,
      pendingPayments: inFlight.pending_payments,
      pendingAmount: num(inFlight.pending_amount),
      pendingRefunds: inFlight.pending_refunds,
    },
    wallets: {
      total: num(wallet.total),
      drivers: num(wallet.drivers),
      passengers: num(wallet.passengers),
    },
    fleet,
    people,
    routes,
    recentBookings: recent,
  };
});

const series = (days = 30) => cache.wrap(SERIES_KEY(days), SERIES_TTL, async () => {
  const [revenue, bookings] = await Promise.all([
    model.revenueSeries(days), model.bookingSeries(days),
  ]);
  const bookingsByDay = new Map(bookings.map((row) => [row.day, row]));
  return {
    days,
    points: revenue.map((row) => {
      const counts = bookingsByDay.get(row.day) || {};
      const deposits = num(row.deposits);
      const balances = num(row.balances);
      return {
        day: row.day,
        deposits,
        balances,
        refunds: num(row.refunds),
        gross: Number((deposits + balances).toFixed(2)),
        payments: row.payments,
        bookingsCreated: counts.created ?? 0,
        bookingsCompleted: counts.completed ?? 0,
        bookingsCancelled: counts.cancelled ?? 0,
        bookingsExpired: counts.expired ?? 0,
      };
    }),
  };
});

const MONEY_KEYS = ['total_fare', 'ride_fare', 'deposit_amount', 'remaining_balance'];

const listBookings = async (filters = {}) => {
  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  const { rows, total } = await model.listBookings({ ...filters, limit, offset });
  return {
    total,
    limit,
    offset,
    hasMore: offset + rows.length < total,
    bookings: rows.map((row) => mapNumbers(row, MONEY_KEYS)),
  };
};

const fleet = async () => {
  const rows = await model.listFleet();
  return rows.map((row) => ({
    ...mapNumbers(row, ['route_fare', 'rating_avg']),
    location_status: row.last_ping_at == null || row.location_age_seconds == null
      ? 'offline'
      : row.location_age_seconds > 90 ? 'stale' : 'live',
  }));
};

/** Admin route listing — includes paused and archived routes. */
const listRoutes = async ({ status = 'all', city = null } = {}) => {
  const rows = await routeModel.list({ status, city });
  return rows.map((row) => mapNumbers(row, ['fare', 'distance_km']));
};

const routePerformance = (days = 30) =>
  cache.wrap(ROUTE_PERF_KEY(days), ROUTE_PERF_TTL, async () => {
    const rows = await model.routePerformance(days);
    return rows.map((row) => mapNumbers(row, ['fare', 'revenue']));
  });

module.exports = { overview, series, listBookings, fleet, listRoutes, routePerformance };
