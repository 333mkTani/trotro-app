import { BusStop, ApproachingBus, Route } from '@/types';
import { ALL_BUS_STOPS } from '@/mocks/stops';
import { ALL_ROUTES } from '@/mocks/routes';

export interface RouteRecommendation {
  id: string;
  pickupStop: BusStop;
  destinationStop: BusStop;
  route: Route;
  walkDistanceToPickup: number;
  walkDistanceToDest: number;
  buses: ApproachingBus[];
  bestBus: ApproachingBus | null;
  estimatedTotalMinutes: number;
  score: number;
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findNearbyStops(
  lat: number,
  lng: number,
  radiusM: number = 5000,
  stops?: BusStop[],
): (BusStop & { distance_m: number })[] {
  const stopsToSearch = stops ?? ALL_BUS_STOPS;
  return stopsToSearch
    .filter((s) => s.status === 'active')
    .map((stop) => ({
      ...stop,
      distance_m: Math.round(haversineDistance(lat, lng, stop.lat, stop.lng)),
    }))
    .filter((s) => s.distance_m <= radiusM)
    .sort((a, b) => a.distance_m - b.distance_m);
}

function estimateWalkMinutes(distanceM: number): number {
  return Math.ceil(distanceM / 80);
}

export function findRouteRecommendations(
  userLat: number,
  userLng: number,
  destLat: number,
  destLng: number,
  maxWalkM: number = 3000,
  stops?: BusStop[],
  routes?: Route[],
  activeBuses?: ApproachingBus[],
): RouteRecommendation[] {
  const stopsToSearch = stops ?? ALL_BUS_STOPS;
  const routesToSearch = routes ?? ALL_ROUTES;
  const busPool = activeBuses ?? [];

  const nearbyPickups = findNearbyStops(userLat, userLng, maxWalkM, stopsToSearch);
  const nearbyDests = findNearbyStops(destLat, destLng, maxWalkM, stopsToSearch);

  if (nearbyPickups.length === 0 || nearbyDests.length === 0) {
    console.log('[RouteFinder] No nearby stops found for pickup or destination');
    return [];
  }

  const recommendations: RouteRecommendation[] = [];

  for (const pickup of nearbyPickups) {
    for (const dest of nearbyDests) {
      if (pickup.id === dest.id) continue;

      const matchingRoutes = routesToSearch.filter(
        (r) =>
          r.status === 'active' &&
          r.stops_sequence.includes(pickup.id) &&
          r.stops_sequence.includes(dest.id) &&
          r.stops_sequence.indexOf(pickup.id) < r.stops_sequence.indexOf(dest.id),
      );

      for (const route of matchingRoutes) {
        const busesForOption = busPool.filter((b) => b.route_name === route.name && b.seats_available > 0);

        const bestBus = busesForOption.length > 0
          ? busesForOption.reduce((best, b) => b.eta_minutes < best.eta_minutes ? b : best)
          : null;

        const walkToPickup = estimateWalkMinutes(pickup.distance_m);
        const pickupIdx = route.stops_sequence.indexOf(pickup.id);
        const destIdx = route.stops_sequence.indexOf(dest.id);
        const segmentRatio = (destIdx - pickupIdx) / (route.stops_sequence.length - 1);
        const rideMinutes = Math.ceil(route.duration_min * segmentRatio);
        const totalMinutes = walkToPickup + (bestBus?.eta_minutes ?? 0) + rideMinutes;

        const walkScore = Math.max(0, 100 - pickup.distance_m / 30);
        const etaScore = bestBus ? Math.max(0, 100 - bestBus.eta_minutes * 5) : 50;
        const seatScore = bestBus ? Math.min(bestBus.seats_available * 10, 50) : 0;
        const destWalkScore = Math.max(0, 50 - dest.distance_m / 60);
        const score = walkScore + etaScore + seatScore + destWalkScore;

        recommendations.push({
          id: `${pickup.id}-${dest.id}-${route.id}`,
          pickupStop: pickup,
          destinationStop: dest,
          route,
          walkDistanceToPickup: pickup.distance_m,
          walkDistanceToDest: dest.distance_m,
          buses: busesForOption,
          bestBus,
          estimatedTotalMinutes: totalMinutes,
          score,
        });
      }
    }
  }

  recommendations.sort((a, b) => b.score - a.score);
  console.log(`[RouteFinder] Found ${recommendations.length} recommendations`);
  return recommendations.slice(0, 10);
}

export function searchStops(query: string, stops?: BusStop[]): BusStop[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const stopsToSearch = stops ?? ALL_BUS_STOPS;
  return stopsToSearch.filter(
    (s) => s.status === 'active' && s.name.toLowerCase().includes(q),
  );
}
