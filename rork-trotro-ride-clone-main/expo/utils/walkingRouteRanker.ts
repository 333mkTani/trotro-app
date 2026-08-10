import { getDirections } from '@/services/routingApi';
import type { MapCoordinate, RouteDirections } from '@/types/routing';
import type { RouteRecommendation } from './routeFinder';

type DirectionsFetcher = (input: {
  origin: MapCoordinate;
  destination: MapCoordinate;
  profile: 'walking';
  steps: false;
}) => Promise<RouteDirections>;

export async function rankRecommendationsByWalkingRoute(
  recommendations: RouteRecommendation[],
  origin: MapCoordinate,
  fetchDirections: DirectionsFetcher = getDirections,
): Promise<RouteRecommendation[]> {
  const routesByStop = new Map<string, Promise<RouteDirections>>();

  for (const recommendation of recommendations) {
    const stop = recommendation.pickupStop;
    if (!routesByStop.has(stop.id)) {
      routesByStop.set(stop.id, fetchDirections({
        origin,
        destination: { latitude: stop.lat, longitude: stop.lng },
        profile: 'walking',
        steps: false,
      }));
    }
  }

  const resolved = new Map<string, RouteDirections>();
  await Promise.all([...routesByStop.entries()].map(async ([stopId, request]) => {
    try {
      const route = await request;
      if (Number.isFinite(route.distanceMeters) && route.distanceMeters >= 0
        && Number.isFinite(route.durationSeconds) && route.durationSeconds >= 0) {
        resolved.set(stopId, route);
      }
    } catch {
      // Keep the straight-line estimate when the routing provider is unavailable.
    }
  }));

  return recommendations
    .map((recommendation) => {
      const walkingRoute = resolved.get(recommendation.pickupStop.id);
      if (!walkingRoute) return recommendation;

      const distance = Math.round(walkingRoute.distanceMeters);
      const durationMinutes = Math.max(1, Math.ceil(walkingRoute.durationSeconds / 60));
      const previousWalkMinutes = recommendation.walkingDurationMinutes;
      return {
        ...recommendation,
        walkDistanceToPickup: distance,
        walkingDurationMinutes: durationMinutes,
        walkingDistanceSource: 'mapbox' as const,
        estimatedTotalMinutes: Math.max(
          0,
          recommendation.estimatedTotalMinutes - previousWalkMinutes + durationMinutes,
        ),
      };
    })
    .sort((a, b) => {
      if (a.walkDistanceToPickup !== b.walkDistanceToPickup) {
        return a.walkDistanceToPickup - b.walkDistanceToPickup;
      }
      return a.estimatedTotalMinutes - b.estimatedTotalMinutes;
    });
}
