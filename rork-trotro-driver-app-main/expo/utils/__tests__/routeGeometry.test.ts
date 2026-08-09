import {
  coordinateKey, createStraightLineFallback, distanceFromRouteMeters, distanceMeters, getRouteBounds,
  isValidCoordinate, isValidRouteGeometry, shouldUpdateRoutingOrigin,
} from '../routeGeometry';

describe('driver route geometry utilities', () => {
  const origin = { latitude: 5.6037, longitude: -0.1969 };
  const destination = { latitude: 5.6148, longitude: -0.187 };

  it('creates a longitude-latitude fallback only for valid coordinates', () => {
    expect(isValidCoordinate(origin)).toBe(true);
    expect(createStraightLineFallback(origin, destination)?.coordinates).toEqual([
      [-0.1969, 5.6037], [-0.187, 5.6148],
    ]);
    expect(createStraightLineFallback({ latitude: NaN, longitude: 0 }, destination)).toBeNull();
  });

  it('does not update the routed origin for GPS jitter below the threshold', () => {
    const nearby = { latitude: 5.60375, longitude: -0.1969 };
    expect(distanceMeters(origin, nearby)).toBeLessThan(100);
    expect(shouldUpdateRoutingOrigin(origin, nearby, 100)).toBe(false);
    expect(shouldUpdateRoutingOrigin(origin, destination, 100)).toBe(true);
  });

  it('validates route geometry and calculates its bounds', () => {
    const geometry = createStraightLineFallback(origin, destination)!;
    expect(isValidRouteGeometry(geometry)).toBe(true);
    expect(getRouteBounds(geometry)).toEqual({
      northEast: { latitude: 5.6148, longitude: -0.187 },
      southWest: { latitude: 5.6037, longitude: -0.1969 },
    });
  });

  it('rounds coordinates used in query keys', () => {
    expect(coordinateKey({ latitude: 5.603712, longitude: -0.196912 }))
      .toBe('5.6037,-0.1969');
  });

  it('detects a driver location away from the current route', () => {
    const geometry = createStraightLineFallback(origin, destination)!;
    expect(distanceFromRouteMeters(origin, geometry)).toBeCloseTo(0, 3);
    expect(distanceFromRouteMeters({ latitude: 5.6047, longitude: -0.1969 }, geometry))
      .toBeGreaterThan(50);
  });
});
