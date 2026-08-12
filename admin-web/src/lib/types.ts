export type Role = 'passenger' | 'driver' | 'admin';

export type AdminUser = {
  id: string;
  full_name: string | null;
  phone: string;
  email: string | null;
  role: Role;
  avatar_url?: string | null;
};

export type LoginResponse = { user: AdminUser; token: string };

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'expired';

export type PaymentStatus =
  | 'unpaid' | 'deposit_pending' | 'deposit_paid' | 'balance_pending' | 'fully_paid'
  | 'refund_pending' | 'partially_refunded' | 'refunded' | 'failed';

export type Booking = {
  id: string;
  status: BookingStatus;
  payment_status: PaymentStatus;
  pickup_stop_name: string;
  destination_stop_name: string;
  desired_arrival_time: string;
  total_fare: number;
  ride_fare: number;
  deposit_amount: number;
  remaining_balance: number;
  ride_payment_method: string | null;
  created_at: string;
  confirmed_at: string | null;
  boarded_at: string | null;
  arrived_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  expired_at: string | null;
  passenger_id: string;
  driver_id: string | null;
  bus_id: string | null;
  route_id: string | null;
  route_name: string | null;
  passenger_name: string | null;
  passenger_phone: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  bus_registration: string | null;
};

export type Overview = {
  generatedAt: string;
  bookings: {
    total: number;
    today: number;
    byStatus: { status: BookingStatus; total: number; today: number }[];
    byPaymentStatus: { payment_status: PaymentStatus; total: number }[];
  };
  revenue: {
    grossCollected: number;
    collectedToday: number;
    depositsCollected: number;
    balancesCollected: number;
    refunded: number;
    noShowCompensation: number;
    netCollected: number;
    depositsHeld: number;
    depositsHeldBookings: number;
    pendingPayments: number;
    pendingAmount: number;
    pendingRefunds: number;
  };
  wallets: { total: number; drivers: number; passengers: number };
  fleet: {
    total: number; active: number; online: number; en_route: number;
    total_seats: number; seats_available: number;
  };
  people: { passengers: number; drivers: number; admins: number; joined_today: number };
  routes: { total: number; active: number; paused: number; archived: number };
  recentBookings: Booking[];
};

export type SeriesPoint = {
  day: string;
  deposits: number;
  balances: number;
  refunds: number;
  gross: number;
  payments: number;
  bookingsCreated: number;
  bookingsCompleted: number;
  bookingsCancelled: number;
  bookingsExpired: number;
};

export type Series = { days: number; points: SeriesPoint[] };

export type BookingPage = {
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  bookings: Booking[];
};

export type FleetBus = {
  id: string;
  registration: string;
  status: 'active' | 'paused' | 'deleted';
  driving_status: 'STATIONARY' | 'EN_ROUTE' | null;
  total_seats: number;
  seats_available: number;
  current_lat: number | null;
  current_lng: number | null;
  last_ping_at: string | null;
  location_age_seconds: number | null;
  location_status: 'live' | 'stale' | 'offline';
  driver_id: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  rating_avg: number;
  rating_count: number;
  route_id: string | null;
  route_name: string | null;
  route_fare: number;
  active_bookings: number;
};

export type RouteRow = {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distance_km: number;
  duration_min: number | null;
  fare: number;
  city: string;
  status: 'active' | 'paused' | 'deleted';
  created_at: string;
  stops_sequence: string[];
};

export type RoutePerformance = {
  id: string;
  name: string;
  origin: string;
  destination: string;
  fare: number;
  city: string;
  status: string;
  bookings: number;
  completed: number;
  cancelled: number;
  revenue: number;
  active_buses: number;
};

export type BusStop = {
  id: string;
  name: string;
  type: 'stop' | 'station';
  lat: number;
  lng: number;
  status: 'active' | 'paused' | 'deleted';
  created_at: string;
};

/**
 * A stop as attached to a route. `sequence` is its 1-based position along the
 * route; the same stop can sit on many routes at different positions, which is
 * why the position lives here and not on the stop itself.
 */
export type RouteStop = Omit<BusStop, 'created_at'> & { sequence: number };

export type ArchiveResult = RouteRow & {
  detached: { active_buses: number; open_bookings: number };
};

/** Shape returned by GET /api/admin/payments/bookings/:id/trace. */
export type PaymentTrace = {
  summary: Record<string, unknown>;
  providerPayments?: Record<string, unknown>[];
  walletTransactions?: Record<string, unknown>[];
  reconciliationEvents?: Record<string, unknown>[];
  [key: string]: unknown;
};

/**
 * Counter registry from GET /api/admin/schedules/metrics. Keys look like
 * `event_name{label=value,other=value}`; values are monotonic counts held in
 * memory by the API process, so they reset on every deploy or restart.
 */
export type RuntimeCounters = Record<string, number>;

/** Trace payloads mirror joined DB rows, so they stay deliberately loose. */
export type TraceResult = Record<string, unknown>;
