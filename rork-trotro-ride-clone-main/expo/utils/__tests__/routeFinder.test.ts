import { findNearbyStops, findRouteRecommendations, searchStops } from '../routeFinder';
import type { BusStop, Route, ApproachingBus } from '@/types';

// Roughly along Spintex Road, Accra. ~0.001 deg of latitude is ~111m, so these
// are spaced a few hundred meters apart — enough to assert relative ordering
// without hand-computing exact haversine distances.
const USER = { lat: 5.6100, lng: -0.1200 };
const DEST = { lat: 5.6000, lng: -0.1000 };

const stopNear: BusStop = { id: 'stop-near', name: 'Spintex Total', type: 'stop', lat: 5.6101, lng: -0.1201, status: 'active' };
const stopFar: BusStop = { id: 'stop-far', name: 'Spintex Junction', type: 'stop', lat: 5.6150, lng: -0.1250, status: 'active' };
const stopPaused: BusStop = { id: 'stop-paused', name: 'Old Stop', type: 'stop', lat: 5.6102, lng: -0.1202, status: 'paused' };
const stopDest: BusStop = { id: 'stop-dest', name: 'Tema Station', type: 'stop', lat: 5.6001, lng: -0.1001, status: 'active' };

const allStops = [stopNear, stopFar, stopPaused, stopDest];

const route: Route = {
  id: 'route-1',
  name: 'Spintex - Tema Station',
  origin: 'Spintex',
  destination: 'Tema Station',
  stops_sequence: [stopFar.id, stopNear.id, stopDest.id],
  reverse_stops_sequence: [stopDest.id, stopNear.id, stopFar.id],
  distance_km: 10,
  duration_min: 30,
  fare: 5,
  status: 'active',
};

const slowBus: ApproachingBus = {
  driver_id: 'driver-slow',
  bus_registration: 'GT-1000-24',
  driver_name: 'Kofi',
  seats_available: 3,
  eta_minutes: 12,
  route_name: route.name,
  lat: USER.lat,
  lng: USER.lng,
};

const fastBus: ApproachingBus = {
  driver_id: 'driver-fast',
  bus_registration: 'GT-2000-24',
  driver_name: 'Ama',
  seats_available: 5,
  eta_minutes: 3,
  route_name: route.name,
  lat: USER.lat,
  lng: USER.lng,
};

const fullBus: ApproachingBus = {
  ...fastBus,
  driver_id: 'driver-full',
  seats_available: 0,
  eta_minutes: 1,
};

describe('findNearbyStops', () => {
  it('excludes stops that are not active', () => {
    const result = findNearbyStops(USER.lat, USER.lng, 500, allStops);
    expect(result.find((s) => s.id === stopPaused.id)).toBeUndefined();
  });

  it('excludes stops outside the search radius', () => {
    const result = findNearbyStops(USER.lat, USER.lng, 100, allStops);
    expect(result.map((s) => s.id)).not.toContain(stopFar.id);
  });

  it('sorts results by ascending distance and attaches distance_m', () => {
    const result = findNearbyStops(USER.lat, USER.lng, 10000, allStops);
    expect(result[0].id).toBe(stopNear.id);
    expect(result.every((s) => typeof s.distance_m === 'number')).toBe(true);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].distance_m).toBeGreaterThanOrEqual(result[i - 1].distance_m);
    }
  });

  it('returns an empty array when no stops are supplied', () => {
    expect(findNearbyStops(USER.lat, USER.lng)).toEqual([]);
  });
});

describe('findRouteRecommendations', () => {
  it('returns no recommendations when nothing is nearby the pickup or destination', () => {
    const result = findRouteRecommendations(0, 0, 0, 0, 3000, allStops, [route], [fastBus]);
    expect(result).toEqual([]);
  });

  it('finds a recommendation connecting a nearby pickup to a nearby destination on the same route', () => {
    const result = findRouteRecommendations(USER.lat, USER.lng, DEST.lat, DEST.lng, 3000, allStops, [route], [fastBus]);

    expect(result.length).toBeGreaterThan(0);
    const rec = result[0];
    expect(rec.pickupStop.id).toBe(stopNear.id);
    expect(rec.destinationStop.id).toBe(stopDest.id);
    expect(rec.route.id).toBe(route.id);
  });

  it('picks the bus with the lowest ETA among matching, non-empty buses', () => {
    const result = findRouteRecommendations(
      USER.lat, USER.lng, DEST.lat, DEST.lng, 3000, allStops, [route], [slowBus, fastBus, fullBus],
    );

    expect(result[0].bestBus?.driver_id).toBe(fastBus.driver_id);
  });

  it('ignores buses with no available seats', () => {
    const result = findRouteRecommendations(
      USER.lat, USER.lng, DEST.lat, DEST.lng, 3000, allStops, [route], [fullBus],
    );

    expect(result[0].bestBus).toBeNull();
    expect(result[0].buses).toEqual([]);
  });

  it('ignores paused routes', () => {
    const pausedRoute: Route = { ...route, status: 'paused' };
    const result = findRouteRecommendations(
      USER.lat, USER.lng, DEST.lat, DEST.lng, 3000, allStops, [pausedRoute], [fastBus],
    );
    expect(result).toEqual([]);
  });

  it('always ranks the nearest eligible pickup first, even when a farther option has a faster bus', () => {
    const nearRoute: Route = {
      ...route,
      id: 'route-near',
      name: 'Near pickup route',
      stops_sequence: [stopNear.id, stopDest.id],
      reverse_stops_sequence: [stopDest.id, stopNear.id],
    };
    const farRoute: Route = {
      ...route,
      id: 'route-far',
      name: 'Far pickup route',
      stops_sequence: [stopFar.id, stopDest.id],
      reverse_stops_sequence: [stopDest.id, stopFar.id],
    };
    const nearRouteBus: ApproachingBus = { ...slowBus, route_name: nearRoute.name };
    const farRouteBus: ApproachingBus = { ...fastBus, route_name: farRoute.name };

    const result = findRouteRecommendations(
      USER.lat,
      USER.lng,
      DEST.lat,
      DEST.lng,
      3000,
      allStops,
      [farRoute, nearRoute],
      [farRouteBus, nearRouteBus],
    );

    const nearIndex = result.findIndex((rec) => rec.pickupStop.id === stopNear.id);
    const farIndex = result.findIndex((rec) => rec.pickupStop.id === stopFar.id);
    expect(nearIndex).toBeGreaterThanOrEqual(0);
    expect(farIndex).toBeGreaterThanOrEqual(0);
    expect(nearIndex).toBeLessThan(farIndex);
  });

  it('uses the exact named destination stop instead of substituting another nearby stop', () => {
    const result = findRouteRecommendations(
      USER.lat,
      USER.lng,
      DEST.lat,
      DEST.lng,
      3000,
      allStops,
      [route],
      [fastBus],
      stopDest.id,
    );

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((rec) => rec.destinationStop.id === stopDest.id)).toBe(true);
  });
});

describe('searchStops', () => {
  it('matches active stops by case-insensitive substring', () => {
    const result = searchStops('spintex total', allStops);
    expect(result.map((s) => s.id)).toEqual([stopNear.id]);
  });

  it('excludes non-active stops even on a name match', () => {
    const result = searchStops('old stop', allStops);
    expect(result).toEqual([]);
  });

  it('returns an empty array for a blank query', () => {
    expect(searchStops('   ', allStops)).toEqual([]);
  });
});
