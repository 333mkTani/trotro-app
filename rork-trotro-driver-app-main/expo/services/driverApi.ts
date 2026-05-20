import {
  DriverDashboard, Booking, DemandStop, OverflowRequest, VerificationResult,
  WalletBalance, WalletTransaction, AutoAcceptedBooking, DrivingStatus,
  SeatSyncData, SeatEvent, AvailableRoute, RouteChangeEligibility, Route,
} from '@/types';
import { useDriverStore } from '@/store/driverStore';
import api from './api';

// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function getDashboard(): Promise<DriverDashboard> {
  const { data } = await api.get('/drivers/me/dashboard');
  return {
    driver_name: data.driver_name ?? '',
    bus_registration: data.bus_registration ?? '',
    is_available: data.is_available ?? false,
    available_seats: data.available_seats ?? 0,
    total_seats: data.total_seats ?? 14,
    assigned_route: data.assigned_route
      ? { id: data.route_id, name: data.assigned_route, origin: data.route_origin ?? '', destination: data.route_destination ?? '' }
      : null,
    todays_trips: data.todays_trips ?? 0,
    pending_booking_count: data.pending_booking_count ?? 0,
    demand_score: 0,
    scheduling_hours: null,
  };
}

export async function toggleAvailability(isAvailable: boolean): Promise<void> {
  await api.patch('/drivers/me/availability', { isAvailable });
}

export async function postLocation(lat: number, lng: number): Promise<void> {
  await api.patch('/drivers/me/location', { lat, lng });
}

export async function updateSchedulingHours(_start: string, _end: string): Promise<void> {
  return;
}

// ─── Bookings ────────────────────────────────────────────────────────────────

export async function getBookings(_dateFilter?: string): Promise<Booking[]> {
  const { data } = await api.get('/bookings');
  return (data as Record<string, unknown>[]).map((b) => ({
    id: b.id as string,
    passenger_name: (b.passenger_name as string) ?? 'Passenger',
    pickup_stop: (b.pickup_stop_name as string) ?? '',
    destination_stop: (b.destination_stop_name as string) ?? '',
    desired_arrival_time: b.desired_arrival_time as string,
    buffer_minutes: (b.buffer_minutes as number) ?? 10,
    status: ((b.status as string)?.toUpperCase() ?? 'PENDING') as Booking['status'],
    created_at: b.created_at as string,
  }));
}

export async function acceptBooking(bookingId: string): Promise<void> {
  await api.post(`/bookings/${bookingId}/confirm`);
}

export async function declineBooking(bookingId: string): Promise<void> {
  await api.post(`/bookings/${bookingId}/cancel`);
}

export async function verifyCode(code: string): Promise<VerificationResult> {
  try {
    await api.post('/bookings/redeem', { code });
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message.toLowerCase() : '';
    if (message.includes('expired')) return { success: false, error_code: 'CODE_EXPIRED' };
    if (message.includes('used')) return { success: false, error_code: 'CODE_ALREADY_USED' };
    if (message.includes('invalidated')) return { success: false, error_code: 'CODE_INVALIDATED' };
    if (message.includes('mismatch')) return { success: false, error_code: 'BUS_MISMATCH' };
    return { success: false, error_code: 'CODE_NOT_FOUND' };
  }
}

// ─── Demand / Overflow ───────────────────────────────────────────────────────

export async function getDemandHeatmap(radiusM: number = 5000): Promise<DemandStop[]> {
  const { currentLat, currentLng } = useDriverStore.getState();
  if (!currentLat || !currentLng) return [];
  const { data } = await api.get('/stops/nearby', {
    params: { lat: currentLat, lng: currentLng, radius_m: radiusM, limit: 20 },
  });
  return (data as Record<string, unknown>[]).map((s) => ({
    id: s.id as string,
    stop_name: s.name as string,
    lat: parseFloat(s.lat as string),
    lng: parseFloat(s.lng as string),
    demand_count: 1,
    distance_km: ((s.distance_m as number) ?? 0) / 1000,
  }));
}

export async function getOverflowRequests(): Promise<OverflowRequest[]> {
  const { data } = await api.get('/bookings', { params: { status: 'pending' } });
  return (data as Record<string, unknown>[]).map((b) => ({
    id: b.id as string,
    stop_name: (b.pickup_stop_name as string) ?? '',
    pickup_stop: (b.pickup_stop_name as string) ?? '',
    destination_stop: (b.destination_stop_name as string) ?? '',
    demand_count: 1,
    distance_km: 0,
    time_posted: b.created_at as string,
    expires_at: b.desired_arrival_time as string,
    lat: 0,
    lng: 0,
    status: 'OPEN' as const,
    passenger_name: (b.passenger_name as string) ?? undefined,
  }));
}

export async function acceptOverflowRequest(requestId: string): Promise<void> {
  await api.post(`/bookings/${requestId}/confirm`);
}

export async function declineOverflowRequest(requestId: string): Promise<void> {
  await api.post(`/bookings/${requestId}/cancel`);
}

// ─── Wallet ──────────────────────────────────────────────────────────────────

export async function getWalletBalance(): Promise<WalletBalance> {
  const { data } = await api.get('/wallet');
  return { available: parseFloat(data.balance), pending: 0, currency: 'GHS' };
}

export async function getTransactions(): Promise<WalletTransaction[]> {
  const { data } = await api.get('/wallet/transactions');
  return (data as Record<string, unknown>[]).map((t) => ({
    id: t.id as string,
    type: 'TRIP_EARNING' as WalletTransaction['type'],
    amount: parseFloat(t.amount as string),
    currency: 'GHS',
    description: (t.description as string) ?? '',
    status: ((t.status as string)?.toUpperCase() ?? 'COMPLETED') as WalletTransaction['status'],
    created_at: t.created_at as string,
    reference: t.reference as string | undefined,
  }));
}

export async function requestWithdrawal(
  amount: number,
  method: string,
  _accountNumber: string,
  _accountName: string,
  _provider?: string
): Promise<WalletTransaction> {
  return {
    id: `wd-${Date.now()}`,
    type: 'WITHDRAWAL',
    amount: -amount,
    currency: 'GHS',
    description: `Withdrawal via ${method}`,
    status: 'PENDING',
    created_at: new Date().toISOString(),
  };
}

export async function fundWallet(amount: number, channel: string): Promise<WalletTransaction> {
  const { data } = await api.post('/wallet/topup', { amount, paymentMethod: channel });
  return {
    id: (data as Record<string, unknown>).id as string,
    type: 'TRIP_EARNING',
    amount,
    currency: 'GHS',
    description: `Wallet top-up via ${channel}`,
    status: 'COMPLETED',
    created_at: (data as Record<string, unknown>).created_at as string,
  };
}

// ─── Driving status & seats ──────────────────────────────────────────────────

export async function updateDrivingStatus(_status: DrivingStatus): Promise<void> {
  return;
}

export async function autoAcceptBooking(_availableSeats: number): Promise<AutoAcceptedBooking | null> {
  return null;
}

export async function updateSeatCount(available: number, total: number): Promise<{ available: number; total: number }> {
  await api.patch('/drivers/me/seats', { availableSeats: available, totalSeats: total });
  return { available, total };
}

export async function fetchSeatSync(): Promise<SeatSyncData> {
  return {
    available_seats: 0,
    total_seats: 14,
    last_updated: new Date().toISOString(),
    recent_events: [],
    has_system_update: false,
  };
}

export async function reportPassengerEvent(
  type: 'BOARDING' | 'ALIGHTING',
  _passengerName?: string
): Promise<SeatEvent> {
  return {
    id: `evt-${Date.now()}`,
    type,
    seats_changed: type === 'BOARDING' ? -1 : 1,
    timestamp: new Date().toISOString(),
    source: 'DRIVER',
  };
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function getAvailableRoutes(): Promise<AvailableRoute[]> {
  const { data } = await api.get('/routes');
  return (data as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    origin: r.origin as string,
    destination: r.destination as string,
    distance_km: parseFloat(r.distance_km as string),
    estimated_duration_min: parseFloat(r.duration_min as string),
    demand_level: 'MEDIUM' as const,
  }));
}

export async function checkRouteChangeEligibility(): Promise<RouteChangeEligibility> {
  return { canChange: true, reasons: [] };
}

export async function changeRoute(routeId: string): Promise<Route> {
  const { data } = await api.get(`/routes/${routeId}`);
  return { id: data.id, name: data.name, origin: data.origin, destination: data.destination };
}
