import { getApproachingBuses } from '@/services/approachingBusApi';
import type { ApproachingBus } from '@/types';
import type { RouteRecommendation } from './routeFinder';

type FetchApproaching = (stopId: string, routeName: string, destinationStopId?: string) => Promise<ApproachingBus[]>;

export async function recommendationsForClosestApproachingDrivers(
  ranked: RouteRecommendation[],
  fetchApproaching: FetchApproaching = getApproachingBuses,
): Promise<RouteRecommendation[]> {
  if (ranked.length === 0) return [];
  const closestPickupId = ranked[0].pickupStop.id;
  const closestPickupRoutes = ranked.filter((item) => item.pickupStop.id === closestPickupId);

  const results = await Promise.all(closestPickupRoutes.map(async (recommendation) => {
    try {
      const buses = await fetchApproaching(
        closestPickupId,
        recommendation.route.name,
        recommendation.destinationStop.id,
      );
      return buses.map((bus) => ({
        ...recommendation,
        id: `${recommendation.id}-${bus.driver_id}`,
        buses,
        bestBus: bus,
        estimatedTotalMinutes:
          recommendation.estimatedTotalMinutes
          - (recommendation.bestBus?.eta_minutes ?? 0)
          + bus.eta_minutes,
      }));
    } catch {
      return [];
    }
  }));

  const driverOptions = results.flat().sort((a, b) => {
    const etaDifference = (a.bestBus?.eta_minutes ?? Infinity) - (b.bestBus?.eta_minutes ?? Infinity);
    return etaDifference || b.bestBus!.seats_available - a.bestBus!.seats_available;
  });

  // Retain route cards when there are no approaching drivers so passengers can
  // still create a bus alert instead of seeing a misleading "no route" state.
  return driverOptions.length > 0
    ? driverOptions
    : closestPickupRoutes.map((item) => ({ ...item, buses: [], bestBus: null }));
}
