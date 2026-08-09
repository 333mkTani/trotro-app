import {
  coordinateKey, createStraightLineFallback, distanceFromRouteMeters, distanceMeters, getActiveRouteStep, getRouteBounds,
  isValidCoordinate, isValidRouteGeometry, shouldUpdateRoutingOrigin,
} from '../routeGeometry';

describe('route geometry utilities', () => {
  const origin = { latitude: 5.6037, longitude: -0.1969 };
  const destination = { latitude: 5.6148, longitude: -0.187 };

  it('validates coordinate ranges and creates longitude-latitude fallback geometry', () => {
    expect(isValidCoordinate(origin)).toBe(true);
    expect(isValidCoordinate({ latitude: 91, longitude: 0 })).toBe(false);
    expect(createStraightLineFallback(origin, destination)?.coordinates).toEqual([
      [-0.1969, 5.6037], [-0.187, 5.6148],
    ]);
  });

  it('uses movement distance to decide when the routing origin changes', () => {
    const nearby = { latitude: 5.60375, longitude: -0.1969 };
    expect(distanceMeters(origin, nearby)).toBeLessThan(100);
    expect(shouldUpdateRoutingOrigin(origin, nearby, 100)).toBe(false);
    expect(shouldUpdateRoutingOrigin(origin, destination, 100)).toBe(true);
  });

  it('validates geometry and calculates map bounds', () => {
    const geometry = createStraightLineFallback(origin, destination)!;
    expect(isValidRouteGeometry(geometry)).toBe(true);
    expect(getRouteBounds(geometry)).toEqual({
      northEast: { latitude: 5.6148, longitude: -0.187 },
      southWest: { latitude: 5.6037, longitude: -0.1969 },
    });
  });

  it('rounds query coordinates to reduce GPS request churn', () => {
    expect(coordinateKey({ latitude: 5.603712, longitude: -0.196912 }))
      .toBe('5.6037,-0.1969');
  });

  it('measures whether a live location has left the route geometry', () => {
    const geometry = createStraightLineFallback(origin, destination)!;
    expect(distanceFromRouteMeters(origin, geometry)).toBeCloseTo(0, 3);
    expect(distanceFromRouteMeters({ latitude: 5.6047, longitude: -0.1969 }, geometry))
      .toBeGreaterThan(50);
  });

  it('advances to the next maneuver after the previous location is passed', () => {
    const geometry = { type: 'LineString' as const, coordinates: [[0, 0], [0.01, 0], [0.02, 0]] as [number, number][] };
    const steps = [
      { instruction: 'Turn at first junction', distanceMeters: 100, durationSeconds: 20, maneuverType: 'turn', modifier: 'right', location: [0.01, 0] as [number, number] },
      { instruction: 'Turn at second junction', distanceMeters: 100, durationSeconds: 20, maneuverType: 'turn', modifier: 'left', location: [0.02, 0] as [number, number] },
    ];
    expect(getActiveRouteStep(steps, { latitude: 0, longitude: 0.005 }, geometry)?.index).toBe(0);
    expect(getActiveRouteStep(steps, { latitude: 0, longitude: 0.012 }, geometry)).toMatchObject({
      index: 1,
      instruction: 'Turn at second junction',
    });
  });
});
