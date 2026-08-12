import { buildQuery, request } from './api';
import type {
  ArchiveResult, BookingPage, BusStop, FleetBus, Overview, PaymentTrace,
  RoutePerformance, RouteRow, RouteStop, RuntimeCounters, Series, TraceResult,
} from './types';

export const fetchOverview = () => request<Overview>('/admin/dashboard/overview');

export const fetchSeries = (days: number) =>
  request<Series>(`/admin/dashboard/series${buildQuery({ days })}`);

export type BookingFilters = {
  status?: string;
  paymentStatus?: string;
  routeId?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export const fetchBookings = (filters: BookingFilters) =>
  request<BookingPage>(`/admin/dashboard/bookings${buildQuery(filters)}`);

export const fetchFleet = () => request<FleetBus[]>('/admin/dashboard/fleet');

export const fetchAdminRoutes = (status: string) =>
  request<RouteRow[]>(`/admin/dashboard/routes${buildQuery({ status })}`);

export const fetchRoutePerformance = (days: number) =>
  request<RoutePerformance[]>(`/admin/dashboard/route-performance${buildQuery({ days })}`);

export const fetchTrace = (bookingId: string) =>
  request<PaymentTrace>(`/admin/payments/bookings/${bookingId}/trace`);

/**
 * The API keeps one process-wide counter registry, so /admin/bus-alerts/metrics
 * returns the identical snapshot — there is no point calling both.
 */
export const fetchRuntimeCounters = () => request<RuntimeCounters>('/admin/schedules/metrics');

export const traceScheduleOccurrence = (id: string) =>
  request<TraceResult>(`/admin/schedules/occurrences/${id}`);

export const traceBusAlert = (id: string) =>
  request<TraceResult>(`/admin/bus-alerts/alerts/${id}`);

export type RouteInput = {
  name: string;
  origin: string;
  destination: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  fare: number;
  distanceKm?: number;
  durationMin?: number;
  city?: string;
};

export const createRoute = (body: RouteInput) =>
  request<RouteRow>('/routes', { method: 'POST', body });

export const updateRoute = (id: string, body: Partial<RouteInput> & { status?: 'active' | 'paused' }) =>
  request<RouteRow>(`/routes/${id}`, { method: 'PATCH', body });

export const archiveRoute = (id: string) =>
  request<ArchiveResult>(`/routes/${id}`, { method: 'DELETE' });

/** Every active stop in the system — the pool an admin picks from. */
export const fetchStops = () => request<BusStop[]>('/stops');

export const fetchRouteStops = (routeId: string) =>
  request<RouteStop[]>(`/routes/${routeId}/stops`);

/**
 * Replaces the route's whole stop list, in array order. Sending the full list
 * (rather than add/move/remove calls) keeps the sequence numbering consistent
 * and makes a repeated save harmless.
 */
export const setRouteStops = (routeId: string, stopIds: string[]) =>
  request<RouteStop[]>(`/routes/${routeId}/stops`, { method: 'PUT', body: { stopIds } });

export type StopInput = {
  name: string;
  type?: 'stop' | 'station';
  lat: number;
  lng: number;
};

export const createStop = (body: StopInput) =>
  request<BusStop>('/stops', { method: 'POST', body });

export const deleteStop = (id: string) =>
  request<BusStop>(`/stops/${id}`, { method: 'DELETE' });
