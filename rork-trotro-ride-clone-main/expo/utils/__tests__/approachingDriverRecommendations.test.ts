import type { ApproachingBus } from '@/types';
import type { RouteRecommendation } from '../routeFinder';
import { recommendationsForClosestApproachingDrivers } from '../approachingDriverRecommendations';

jest.mock('@/services/approachingBusApi', () => ({ getApproachingBuses: jest.fn() }));

const makeRecommendation = (stopId: string, walkDistance: number): RouteRecommendation => ({
  id: `rec-${stopId}`,
  pickupStop: { id: stopId, name: stopId, type: 'stop', lat: 6.67, lng: -1.57, status: 'active' },
  destinationStop: { id: 'dest', name: 'Dest', type: 'stop', lat: 6.7, lng: -1.58, status: 'active' },
  route: { id: `route-${stopId}`, name: `Route ${stopId}`, origin: 'A', destination: 'B', stops_sequence: [stopId, 'dest'], reverse_stops_sequence: ['dest', stopId], distance_km: 5, duration_min: 20, fare: 5, status: 'active' },
  walkDistanceToPickup: walkDistance,
  walkDistanceToDest: 0,
  buses: [],
  bestBus: null,
  estimatedTotalMinutes: 20,
  score: 100,
  walkingDistanceSource: 'mapbox',
  walkingDurationMinutes: 5,
});

const bus = (id: string, eta: number): ApproachingBus => ({
  driver_id: id, bus_registration: id, driver_name: id, seats_available: 5,
  eta_minutes: eta, route_name: 'Route stairs', lat: 6.67, lng: -1.57,
});

describe('recommendationsForClosestApproachingDrivers', () => {
  it('shows separate drivers only for the closest walking-ranked pickup', async () => {
    const result = await recommendationsForClosestApproachingDrivers(
      [makeRecommendation('stairs', 400), makeRecommendation('manchester', 800)],
      async (stopId) => stopId === 'stairs' ? [bus('driver-a', 6), bus('driver-b', 3)] : [],
    );
    expect(result.map((item) => item.pickupStop.id)).toEqual(['stairs', 'stairs']);
    expect(result.map((item) => item.bestBus?.driver_id)).toEqual(['driver-b', 'driver-a']);
  });

  it('retains the closest route without a driver so bus alerts remain available', async () => {
    const result = await recommendationsForClosestApproachingDrivers(
      [makeRecommendation('stairs', 400), makeRecommendation('manchester', 800)],
      async () => [],
    );
    expect(result).toHaveLength(1);
    expect(result[0].pickupStop.id).toBe('stairs');
    expect(result[0].bestBus).toBeNull();
  });

  it('passes the passenger destination to direction-aware driver lookup', async () => {
    const fetcher = jest.fn(async () => [bus('driver-a', 4)]);
    await recommendationsForClosestApproachingDrivers([makeRecommendation('stairs', 400)], fetcher);
    expect(fetcher).toHaveBeenCalledWith('stairs', 'Route stairs', 'dest');
  });
});
