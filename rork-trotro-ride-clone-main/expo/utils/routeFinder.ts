import { BusStop, ApproachingBus, Route } from '@/types';

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
  const stopsToSearch = stops ?? [];
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
  const stopsToSearch = stops ?? [];
  const routesToSearch = routes ?? [];
  const busPool = activeBuses ?? [];

  const nearbyPickups = findNearbyStops(userLat, userLng, maxWalkM, stopsToSearch);
  const nearbyDests = findNearbyStops(destLat, destLng, maxWalkM, stopsToSearch);

  if (nearbyPickups.length === 0 || nearbyDests.length === 0) {
    console.log('[RouteFinder] No nearby stops found for pickup or destination');
    return [];
  }

  const recommendations: RouteRecommendation[] = [];

  for (const pickup of nearbyPickups) {
    const routesForPickup = routesToSearch.filter(
      (r) => r.status === 'active' && r.stops_sequence.includes(pickup.id),
    );

    for (const route of routesForPickup) {
      const pickupFwdIdx = route.stops_sequence.indexOf(pickup.id);
      // Fall back to computing the reverse locally if the backend hasn't supplied it yet.
      const revSeq = route.reverse_stops_sequence.length > 0
        ? route.reverse_stops_sequence
        : [...route.stops_sequence].reverse();
      const pickupRevIdx = revSeq.indexOf(pickup.id);

      // Accept destinations reachable in either direction on this route.
      const destOptions = nearbyDests.filter((d) => {
        if (d.id === pickup.id) return false;
        if (route.stops_sequence.indexOf(d.id) > pickupFwdIdx) return true;
        if (revSeq.indexOf(d.id) > pickupRevIdx) return true;
        return false;
      });

      if (destOptions.length === 0) continue;

      // Pick the single destination stop closest to the user's target (lowest distance_m).
      const dest = destOptions.reduce((best, d) => (d.distance_m < best.distance_m ? d : best));

      const busesForOption = busPool.filter((b) => b.route_name === route.name && b.seats_available > 0);
      const bestBus = busesForOption.length > 0
        ? busesForOption.reduce((best, b) => (b.eta_minutes < best.eta_minutes ? b : best))
        : null;

      const walkToPickup = estimateWalkMinutes(pickup.distance_m);
      const destIdx = route.stops_sequence.indexOf(dest.id);
      // Math.abs handles both forward (destIdx > pickupFwdIdx) and reverse (destIdx < pickupFwdIdx).
      const segmentRatio = Math.abs(destIdx - pickupFwdIdx) / (route.stops_sequence.length - 1);
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

  // Primary: nearest boarding stop (unconditional). Secondary: fastest total trip.
  recommendations.sort((a, b) => {
    if (a.walkDistanceToPickup !== b.walkDistanceToPickup) {
      return a.walkDistanceToPickup - b.walkDistanceToPickup;
    }
    return a.estimatedTotalMinutes - b.estimatedTotalMinutes;
  });
  console.log(`[RouteFinder] Found ${recommendations.length} recommendations`);
  return recommendations.slice(0, 10);
}

export function searchStops(query: string, stops?: BusStop[]): BusStop[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const stopsToSearch = stops ?? [];
  return stopsToSearch.filter(
    (s) => s.status === 'active' && s.name.toLowerCase().includes(q),
  );
}
