import type { RouteRecommendation } from '../routeFinder';

jest.mock('@/services/routingApi', () => ({ getDirections: jest.fn() }));

import { rankRecommendationsByWalkingRoute } from '../walkingRouteRanker';

const recommendation = (id: string, distance: number): RouteRecommendation => ({
  id,
  pickupStop: { id, name: id, type: 'stop', lat: 6.67, lng: -1.56, status: 'active' },
  destinationStop: { id: 'destination', name: 'Destination', type: 'stop', lat: 6.7, lng: -1.58, status: 'active' },
  route: {
    id: `route-${id}`,
    name: `Route ${id}`,
    origin: id,
    destination: 'Destination',
    stops_sequence: [id, 'destination'],
    reverse_stops_sequence: ['destination', id],
    distance_km: 3,
    duration_min: 10,
    fare: 5,
    status: 'active',
  },
  walkDistanceToPickup: distance,
  walkDistanceToDest: 0,
  buses: [],
  bestBus: null,
  estimatedTotalMinutes: 15,
  score: 100,
  walkingDistanceSource: 'straight-line',
  walkingDurationMinutes: Math.ceil(distance / 80),
});

describe('rankRecommendationsByWalkingRoute', () => {
  it('ranks candidates using routed walking distance instead of straight-line distance', async () => {
    const fetcher = jest.fn(async ({ destination }: { destination: { latitude: number } }) => ({
      provider: 'mapbox' as const,
      profile: 'walking' as const,
      distanceMeters: destination.latitude === 6.671 ? 900 : 300,
      durationSeconds: destination.latitude === 6.671 ? 720 : 240,
      geometry: { type: 'LineString' as const, coordinates: [[-1.56, 6.67], [-1.56, destination.latitude]] as [number, number][] },
      steps: [],
      generatedAt: new Date().toISOString(),
    }));
    const closerStraightLine = recommendation('stairs', 200);
    closerStraightLine.pickupStop.lat = 6.671;
    const fartherStraightLine = recommendation('manchester', 500);
    fartherStraightLine.pickupStop.lat = 6.672;

    const result = await rankRecommendationsByWalkingRoute(
      [closerStraightLine, fartherStraightLine],
      { latitude: 6.67, longitude: -1.56 },
      fetcher,
    );

    expect(result.map((item) => item.id)).toEqual(['manchester', 'stairs']);
    expect(result.every((item) => item.walkingDistanceSource === 'mapbox')).toBe(true);
  });

  it('retains the straight-line estimate when walking routing fails', async () => {
    const original = recommendation('stairs', 400);
    const result = await rankRecommendationsByWalkingRoute(
      [original],
      { latitude: 6.67, longitude: -1.56 },
      async () => { throw new Error('routing unavailable'); },
    );

    expect(result[0]).toEqual(original);
    expect(result[0].walkingDistanceSource).toBe('straight-line');
  });
});
