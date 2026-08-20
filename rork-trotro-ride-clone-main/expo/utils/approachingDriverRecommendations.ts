import { getApproachingBuses } from '@/services/approachingBusApi';
import type { ApproachingBus } from '@/types';
import type { RouteRecommendation } from './routeFinder';

type FetchApproaching = (stopId: string, routeName: string, destinationStopId?: string) => Promise<ApproachingBus[]>;

/**
 * Fetch approaching buses for every viable nearby pickup stop. The previous
 * implementation queried only ranked[0], which meant a perfectly valid nearby
 * alternative was hidden whenever the closest stop had no approaching bus.
 * Stops remain ordered by walking distance as the final tie-breaker, while
 * live bus ETA is preferred when deciding which option to show first.
 */
export async function recommendationsForClosestApproachingDrivers(
  ranked: RouteRecommendation[],
  fetchApproaching: FetchApproaching = getApproachingBuses,
): Promise<RouteRecommendation[]> {
  if (ranked.length === 0) return [];

  const pickupGroups = new Map<string, RouteRecommendation[]>();
  for (const recommendation of ranked) {
    const group = pickupGroups.get(recommendation.pickupStop.id) ?? [];
    group.push(recommendation);
    pickupGroups.set(recommendation.pickupStop.id, group);
  }

  const results = await Promise.all(
    [...pickupGroups.values()].flatMap((recommendations) =>
      recommendations.map(async (recommendation) => {
        try {
          const buses = await fetchApproaching(
            recommendation.pickupStop.id,
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
      }),
    ),
  );

  const driverOptions = results.flat().sort((a, b) => {
    const etaDifference = (a.bestBus?.eta_minutes ?? Infinity) - (b.bestBus?.eta_minutes ?? Infinity);
    if (etaDifference !== 0) return etaDifference;
    return a.walkDistanceToPickup - b.walkDistanceToPickup;
  });

  if (driverOptions.length > 0) return driverOptions;

  // Preserve the nearest route as an alertable fallback when no live bus is
  // approaching any candidate stop, without claiming that a bus is available.
  const closest = ranked[0];
  return [{ ...closest, buses: [], bestBus: null }];
}
