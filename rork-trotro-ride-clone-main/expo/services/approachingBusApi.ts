import { api } from './api';
import type { ApproachingBus } from '@/types';

export async function getApproachingBuses(stopId: string, routeName: string, destinationStopId?: string): Promise<ApproachingBus[]> {
  const { data } = await api.get<Record<string, unknown>[]>('/buses/active', {
    params: { stop_id: stopId, destination_stop_id: destinationStopId, route_name: routeName },
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  return data.map((bus) => ({
    driver_id: String(bus.driver_id),
    bus_registration: String(bus.bus_registration),
    driver_name: typeof bus.driver_name === 'string' ? bus.driver_name : 'Driver',
    seats_available: Number(bus.seats_available || 0),
    eta_minutes: Number(bus.eta_minutes ?? 1),
    route_name: typeof bus.route_name === 'string' ? bus.route_name : routeName,
    lat: Number(bus.current_lat || 0),
    lng: Number(bus.current_lng || 0),
    arrival_state: bus.arrival_state === 'boarding_now' ? 'boarding_now' as const : 'approaching' as const,
  })).filter((bus) => bus.driver_id && bus.seats_available > 0);
}
