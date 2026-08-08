import {
  DriverDashboard, Booking, DemandStop, OverflowRequest, VerificationResult,
  WalletBalance, WalletTransaction, AutoAcceptedBooking, DrivingStatus,
  SeatSyncData, SeatEvent, AvailableRoute, RouteChangeEligibility, Route,
  FutureRideRequest,
  ScheduledBoardingResult,
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
    driving_status: data.driving_status ?? 'STATIONARY',
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

// Scheduled reservations
export async function getFutureRequests(): Promise<FutureRideRequest[]> {
  const { data } = await api.get('/driver-schedules/requests');
  return (data as Record<string, unknown>[]).map((request) => ({
    id: request.id as string,
    serviceDate: request.service_date as string,
    boardingStart: request.boarding_start_at as string,
    boardingEnd: request.boarding_end_at as string,
    departureStopId: request.departure_stop_id as string,
    departureStation: (request.departure_stop_name as string) ?? 'Departure station',
    destinationStation: (request.destination_stop_name as string) ?? 'Destination station',
    availableSeats: Number(request.future_seats_remaining) || 0,
    primaryDeadline: request.primary_acceptance_deadline as string,
    finalDeadline: request.final_acceptance_deadline as string,
    status: (request.status as string) ?? 'pending',
    currentState: request.status === 'accepted' ? 'ACCEPTED' : 'AWAITING',
  }));
}

export async function acceptFutureRequest(id: string): Promise<void> {
  await api.post(`/driver-schedules/${id}/accept`);
}

export async function declineFutureRequest(id: string, reason?: string): Promise<void> {
  await api.post(`/driver-schedules/${id}/decline`, reason ? { reason } : {});
}

export async function withdrawFutureRequest(id: string, reason?: string): Promise<void> {
  await api.post(`/driver-schedules/${id}/withdraw`, reason ? { reason } : {});
}

export async function redeemScheduledBoardingCode(code: string): Promise<ScheduledBoardingResult> {
  const { data } = await api.post('/driver-schedules/boarding/redeem', { code });
  return data as ScheduledBoardingResult;
}

export async function departFutureRequest(id: string): Promise<void> {
  await api.post(`/driver-schedules/${id}/depart`);
}

export async function getStopCoordinates(id: string): Promise<{ lat: number; lng: number }> {
  const { data } = await api.get(`/stops/${id}`);
  const lat = Number(data.lat);
  const lng = Number(data.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('The departure station has no valid map coordinates.');
  }
  return { lat, lng };
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

export async function verifyBoardingCode(code: string): Promise<VerificationResult> {
  try {
    const result = await redeemScheduledBoardingCode(code);
    return {
      success: true,
      source: 'SCHEDULED',
      passenger_name: result.booking.passenger_name,
      confirmed_at: new Date().toISOString(),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message.toLowerCase() : '';

    // Only absence is safe to fall back from. Lifecycle and ownership failures
    // belong to a scheduled code and must be shown without trying another flow.
    if (message.includes('boarding code not found')) {
      const ordinary = await verifyCode(code);
      return { ...ordinary, source: ordinary.success ? 'IMMEDIATE' : ordinary.source };
    }
    if (message.includes('expired')) return { success: false, source: 'SCHEDULED', error_code: 'CODE_EXPIRED' };
    if (message.includes('used')) return { success: false, source: 'SCHEDULED', error_code: 'CODE_ALREADY_USED' };
    if (message.includes('another driver') || message.includes('assigned driver')) {
      return { success: false, source: 'SCHEDULED', error_code: 'WRONG_DRIVER' };
    }
    if (message.includes('boarding is not open') || message.includes('not active yet')) {
      return { success: false, source: 'SCHEDULED', error_code: 'BOARDING_NOT_OPEN' };
    }
    if (message.includes('cancel') || message.includes('invalidated')) {
      return { success: false, source: 'SCHEDULED', error_code: 'CODE_INVALIDATED' };
    }
    return { success: false, source: 'SCHEDULED', error_code: 'CODE_NOT_FOUND' };
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

// Bookings a passenger placed on this driver's bus that the backend already
// auto-confirmed (a boarding code was issued). Shown on the Requests screen so
// the driver knows who to expect and at which stop — no accept/decline needed.
export async function getConfirmedBookings(): Promise<OverflowRequest[]> {
  const { data } = await api.get('/bookings', { params: { status: 'confirmed' } });
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
    status: 'CONFIRMED' as const,
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

export interface PayoutBank {
  name: string;
  code: string;
}

export async function getPayoutBanks(): Promise<PayoutBank[]> {
  const { data } = await api.get('/wallet/banks');
  return data as PayoutBank[];
}

export async function requestWithdrawal(params: {
  amount: number;
  method: 'MOBILE_MONEY' | 'BANK_TRANSFER';
  accountNumber: string;
  accountName: string;
  providerId?: string;
  bankCode?: string;
}): Promise<WalletTransaction> {
  const { data } = await api.post('/wallet/withdraw', params);
  const tx = (data as { transaction: Record<string, unknown> }).transaction;
  return {
    id: tx.id as string,
    type: 'WITHDRAWAL',
    amount: parseFloat(tx.amount as string),
    currency: 'GHS',
    description: (tx.description as string) ?? '',
    status: ((tx.status as string)?.toUpperCase() ?? 'PENDING') as WalletTransaction['status'],
    created_at: tx.created_at as string,
    reference: tx.reference as string | undefined,
  };
}

// ─── Driving status & seats ──────────────────────────────────────────────────

export async function updateDrivingStatus(status: DrivingStatus): Promise<void> {
  await api.patch('/drivers/me/driving-status', { drivingStatus: status });
}

export async function autoAcceptBooking(availableSeats: number): Promise<AutoAcceptedBooking | null> {
  if (availableSeats <= 0) return null;

  const { data } = await api.get('/bookings', { params: { status: 'pending' } });
  const pending = data as Record<string, unknown>[];
  if (!pending.length) return null;

  const next = pending[0];
  const { data: result } = await api.post(`/bookings/${next.id}/confirm`);
  const booking = (result as Record<string, unknown>).booking as Record<string, unknown>;

  return {
    id: booking.id as string,
    passenger_name: (next.passenger_name as string) ?? 'Passenger',
    pickup_stop: (booking.pickup_stop_name as string) ?? '',
    destination_stop: (booking.destination_stop_name as string) ?? '',
    seats_taken: 1,
    auto_accepted_at: new Date().toISOString(),
  };
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

export async function changeRoute(routeId: string): Promise<Route> {
  // Persist the route change in the database first
  await api.patch('/drivers/me/route', { routeId });
  // Then fetch the full route details to return to the store
  const { data } = await api.get(`/routes/${routeId}`);
  return { id: data.id, name: data.name, origin: data.origin, destination: data.destination };
}
