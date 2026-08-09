import api from './api';
import type { DirectionsRequest, RouteDirections } from '@/types/routing';

export async function getDirections({
  origin,
  destination,
  profile = 'driving',
  steps = true,
  signal,
}: DirectionsRequest): Promise<RouteDirections> {
  const { data } = await api.get<RouteDirections>('/routing/directions', {
    params: {
      originLat: origin.latitude,
      originLng: origin.longitude,
      destinationLat: destination.latitude,
      destinationLng: destination.longitude,
      profile,
      steps,
    },
    signal,
  });

  return data;
}
