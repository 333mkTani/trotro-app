/**
 * Read-only aggregate queries backing the admin dashboard.
 *
 * Everything here is cross-user by design and is only ever reached through
 * routes guarded by `requireRole('admin')`. Ghana runs on UTC+0, so
 * `date_trunc('day', now())` is the local day boundary.
 */
const { query } = require('../config/db');

const ONLINE_WINDOW = "now() - interval '2 minutes'";

const bookingStatusBreakdown = async () => {
  const { rows } = await query(
    `select status::text as status,
            count(*)::int as total,
            count(*) filter (where created_at >= date_trunc('day', now()))::int as today
       from public.bookings
      group by status
      order by status`,
  );
  return rows;
};

const paymentStatusBreakdown = async () => {
  const { rows } = await query(
    `select payment_status::text as payment_status, count(*)::int as total
       from public.bookings
      group by payment_status
      order by payment_status`,
  );
  return rows;
};

const paymentTotals = async () => {
  const { rows } = await query(
    `select
       coalesce(sum(amount) filter (where type in ('deposit','balance')), 0)::numeric as gross_collected,
       coalesce(sum(amount) filter (where type in ('deposit','balance')
         and confirmed_at >= date_trunc('day', now())), 0)::numeric                   as collected_today,
       coalesce(sum(amount) filter (where type = 'deposit'), 0)::numeric              as deposits_collected,
       coalesce(sum(amount) filter (where type = 'balance'), 0)::numeric              as balances_collected,
       coalesce(sum(amount) filter (where type = 'refund'), 0)::numeric               as refunded,
       coalesce(sum(amount) filter (where type = 'no_show_compensation'), 0)::numeric as no_show_compensation
     from public.booking_payments
    where status = 'succeeded'`,
  );
  return rows[0];
};

/** Payments that left the passenger's account but have not settled either way. */
const paymentsInFlight = async () => {
  const { rows } = await query(
    `select count(*)::int as pending_payments,
            coalesce(sum(amount), 0)::numeric as pending_amount,
            count(*) filter (where type = 'refund')::int as pending_refunds
       from public.booking_payments
      where status in ('initiated', 'pending')`,
  );
  return rows[0];
};

/** Deposits collected on rides that have not yet settled or refunded. */
const depositsHeld = async () => {
  const { rows } = await query(
    `select coalesce(sum(deposit_amount), 0)::numeric as amount,
            count(*)::int as bookings
       from public.bookings
      where payment_status in ('deposit_paid', 'balance_pending')
        and status not in ('completed', 'cancelled', 'expired')`,
  );
  return rows[0];
};

const fleetTotals = async () => {
  const { rows } = await query(
    `select count(*)::int as total,
            count(*) filter (where status = 'active')::int as active,
            count(*) filter (where last_ping_at >= ${ONLINE_WINDOW})::int as online,
            count(*) filter (where driving_status = 'EN_ROUTE')::int as en_route,
            coalesce(sum(total_seats)     filter (where status = 'active'), 0)::int as total_seats,
            coalesce(sum(seats_available) filter (where status = 'active'), 0)::int as seats_available
       from public.buses`,
  );
  return rows[0];
};

const peopleTotals = async () => {
  const { rows } = await query(
    `select count(*) filter (where role = 'passenger')::int as passengers,
            count(*) filter (where role = 'driver')::int    as drivers,
            count(*) filter (where role = 'admin')::int     as admins,
            count(*) filter (where created_at >= date_trunc('day', now()))::int as joined_today
       from public.profiles`,
  );
  return rows[0];
};

const routeTotals = async () => {
  const { rows } = await query(
    `select count(*)::int as total,
            count(*) filter (where status = 'active')::int as active,
            count(*) filter (where status = 'paused')::int as paused,
            count(*) filter (where status = 'deleted')::int as archived
       from public.routes`,
  );
  return rows[0];
};

/** Money sitting in user wallets — a liability, not revenue. */
const walletFloat = async () => {
  const { rows } = await query(
    `select coalesce(sum(w.balance), 0)::numeric as total,
            coalesce(sum(w.balance) filter (where p.role = 'driver'), 0)::numeric as drivers,
            coalesce(sum(w.balance) filter (where p.role = 'passenger'), 0)::numeric as passengers
       from public.wallets w
       join public.profiles p on p.id = w.user_id`,
  );
  return rows[0];
};

/** Daily succeeded-payment series for the revenue chart. */
const revenueSeries = async (days = 30) => {
  const { rows } = await query(
    `with span as (
       select generate_series(
         date_trunc('day', now()) - make_interval(days => $1::int - 1),
         date_trunc('day', now()),
         interval '1 day'
       ) as day
     )
     select to_char(span.day, 'YYYY-MM-DD') as day,
            coalesce(sum(bp.amount) filter (where bp.type = 'deposit'), 0)::numeric as deposits,
            coalesce(sum(bp.amount) filter (where bp.type = 'balance'), 0)::numeric as balances,
            coalesce(sum(bp.amount) filter (where bp.type = 'refund'), 0)::numeric  as refunds,
            count(bp.id) filter (where bp.type in ('deposit','balance'))::int       as payments
       from span
       left join public.booking_payments bp
         on bp.status = 'succeeded'
        and bp.confirmed_at >= span.day
        and bp.confirmed_at <  span.day + interval '1 day'
      group by span.day
      order by span.day asc`,
    [days],
  );
  return rows;
};

/** Bookings created per day, alongside the revenue series. */
const bookingSeries = async (days = 30) => {
  const { rows } = await query(
    `with span as (
       select generate_series(
         date_trunc('day', now()) - make_interval(days => $1::int - 1),
         date_trunc('day', now()),
         interval '1 day'
       ) as day
     )
     select to_char(span.day, 'YYYY-MM-DD') as day,
            count(b.id)::int as created,
            count(b.id) filter (where b.status = 'completed')::int as completed,
            count(b.id) filter (where b.status = 'cancelled')::int as cancelled,
            count(b.id) filter (where b.status = 'expired')::int   as expired
       from span
       left join public.bookings b
         on b.created_at >= span.day
        and b.created_at <  span.day + interval '1 day'
      group by span.day
      order by span.day asc`,
    [days],
  );
  return rows;
};

const BOOKING_COLUMNS = `
  b.id, b.status::text as status, b.payment_status::text as payment_status,
  b.pickup_stop_name, b.destination_stop_name, b.desired_arrival_time,
  b.total_fare, b.ride_fare, b.deposit_amount, b.remaining_balance,
  b.ride_payment_method::text as ride_payment_method,
  b.created_at, b.confirmed_at, b.boarded_at, b.arrived_at, b.completed_at,
  b.cancelled_at, b.expired_at,
  b.passenger_id, b.driver_id, b.bus_id, b.route_id,
  coalesce(b.route_name, r.name) as route_name,
  p.full_name as passenger_name, p.phone as passenger_phone,
  d.full_name as driver_name, d.phone as driver_phone,
  bus.registration as bus_registration`;

const BOOKING_JOINS = `
  from public.bookings b
  left join public.profiles p  on p.id = b.passenger_id
  left join public.drivers  d  on d.id = b.driver_id
  left join public.buses    bus on bus.id = b.bus_id
  left join public.routes   r  on r.id = b.route_id`;

/**
 * Cross-user booking search. `search` matches a booking id prefix, passenger
 * name/phone or stop name. Returns `{ rows, total }` for offset pagination.
 */
const listBookings = async ({
  status = null, paymentStatus = null, routeId = null, driverId = null,
  from = null, to = null, search = null, limit = 50, offset = 0,
} = {}) => {
  const params = [];
  const where = [];
  if (status) where.push(`b.status = $${params.push(status)}::booking_status`);
  if (paymentStatus) {
    where.push(`b.payment_status = $${params.push(paymentStatus)}::reservation_payment_status`);
  }
  if (routeId) where.push(`b.route_id = $${params.push(routeId)}`);
  if (driverId) where.push(`b.driver_id = $${params.push(driverId)}`);
  if (from) where.push(`b.created_at >= $${params.push(from)}::timestamptz`);
  if (to) where.push(`b.created_at < ($${params.push(to)}::timestamptz + interval '1 day')`);
  if (search) {
    const idx = params.push(`%${search}%`);
    where.push(`(b.id::text ilike $${idx}
      or p.full_name ilike $${idx}
      or p.phone ilike $${idx}
      or b.pickup_stop_name ilike $${idx}
      or b.destination_stop_name ilike $${idx})`);
  }
  const whereClause = where.length ? `where ${where.join(' and ')}` : '';

  const countParams = [...params];
  const { rows: countRows } = await query(
    `select count(*)::int as total ${BOOKING_JOINS} ${whereClause}`, countParams,
  );

  const { rows } = await query(
    `select ${BOOKING_COLUMNS} ${BOOKING_JOINS} ${whereClause}
      order by b.created_at desc
      limit $${params.push(limit)} offset $${params.push(offset)}`,
    params,
  );
  return { rows, total: countRows[0]?.total ?? 0 };
};

/** Live fleet view: every bus with its driver, route and GPS freshness. */
const listFleet = async () => {
  const { rows } = await query(
    `select b.id, b.registration, b.status::text as status, b.driving_status,
            b.total_seats, b.seats_available, b.current_lat, b.current_lng, b.last_ping_at,
            extract(epoch from (now() - b.last_ping_at))::int as location_age_seconds,
            b.driver_id, d.full_name as driver_name, d.phone as driver_phone,
            d.rating_avg, d.rating_count,
            b.route_id, r.name as route_name, r.fare as route_fare,
            (select count(*)::int from public.bookings k
              where k.bus_id = b.id and k.status = 'confirmed') as active_bookings
       from public.buses b
       left join public.drivers d on d.id = b.driver_id
       left join public.routes  r on r.id = b.route_id
      order by (b.last_ping_at is null), b.last_ping_at desc nulls last`,
  );
  return rows;
};

/** Most recent bookings, for the dashboard activity feed. */
const recentBookings = async (limit = 8) => {
  const { rows } = await query(
    `select ${BOOKING_COLUMNS} ${BOOKING_JOINS}
      order by b.created_at desc
      limit $1`,
    [limit],
  );
  return rows;
};

/**
 * Per-route performance table. Bookings and revenue are aggregated in separate
 * lateral subqueries — joining both in one pass would fan the booking count out
 * by the number of payment rows attached to each booking.
 */
const routePerformance = async (days = 30) => {
  const { rows } = await query(
    `select r.id, r.name, r.origin, r.destination, r.fare, r.city, r.status::text as status,
            bk.bookings, bk.completed, bk.cancelled, rev.revenue,
            (select count(*)::int from public.buses bu
              where bu.route_id = r.id and bu.status = 'active') as active_buses
       from public.routes r
       left join lateral (
         select count(*)::int as bookings,
                count(*) filter (where b.status = 'completed')::int as completed,
                count(*) filter (where b.status = 'cancelled')::int as cancelled
           from public.bookings b
          where b.route_id = r.id
            and b.created_at >= now() - make_interval(days => $1::int)
       ) bk on true
       left join lateral (
         select coalesce(sum(bp.amount), 0)::numeric as revenue
           from public.booking_payments bp
           join public.bookings b2 on b2.id = bp.booking_id
          where b2.route_id = r.id
            and bp.status = 'succeeded'
            and bp.type in ('deposit', 'balance')
            and bp.confirmed_at >= now() - make_interval(days => $1::int)
       ) rev on true
      where r.status <> 'deleted'
      order by bk.bookings desc nulls last, r.name asc`,
    [days],
  );
  return rows;
};

module.exports = {
  bookingStatusBreakdown, paymentStatusBreakdown, paymentTotals, paymentsInFlight,
  depositsHeld, fleetTotals, peopleTotals, routeTotals, walletFloat,
  revenueSeries, bookingSeries, listBookings, listFleet, recentBookings, routePerformance,
};
