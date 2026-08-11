const {
  projectOntoRoute, deriveMovementState, isStopAhead, isDestinationAheadAfterPickup,
  bearingDegrees, resolveEffectiveDirection,
} = require('../routeProgress');

const route = [
  { id: 'a', lat: 6.67, lng: -1.57 },
  { id: 'b', lat: 6.68, lng: -1.57 },
  { id: 'c', lat: 6.69, lng: -1.57 },
];

describe('route progress detection', () => {
  it('projects GPS positions to increasing progress along an ordered route', () => {
    const first = projectOntoRoute({ lat: 6.675, lng: -1.57 }, route);
    const second = projectOntoRoute({ lat: 6.685, lng: -1.57 }, route);
    expect(second.progressM).toBeGreaterThan(first.progressM);
    expect(first.offsetM).toBeLessThan(2);
  });

  it('detects forward and reverse movement while ignoring small GPS jitter', () => {
    const forward = deriveMovementState({
      previousProgressM: 100,
      previousPingAt: new Date(Date.now() - 30_000),
      currentProjection: { progressM: 180, offsetM: 5 },
    });
    expect(forward.direction).toBe('forward');

    const jitter = deriveMovementState({
      previousProgressM: 180,
      previousPingAt: new Date(Date.now() - 30_000),
      previousDirection: 'forward',
      previousConfidence: 2,
      currentProjection: { progressM: 170, offsetM: 5 },
    });
    expect(jitter.direction).toBe('forward');
  });

  it('rejects stops already passed in the detected direction', () => {
    expect(isStopAhead({ direction: 'forward', confidence: 2, busProgressM: 800, stopProgressM: 400 })).toBe(false);
    expect(isStopAhead({ direction: 'forward', confidence: 2, busProgressM: 800, stopProgressM: 1000 })).toBe(true);
    expect(isStopAhead({ direction: 'reverse', confidence: 2, busProgressM: 800, stopProgressM: 1000 })).toBe(false);
  });

  it('keeps buses discoverable until enough movement establishes direction', () => {
    expect(isStopAhead({ direction: 'unknown', confidence: 0, busProgressM: 800, stopProgressM: 400 })).toBe(true);
  });

  it('requires the destination to remain ahead after pickup in the same direction', () => {
    expect(isDestinationAheadAfterPickup({ direction: 'forward', pickupProgressM: 500, destinationProgressM: 900 })).toBe(true);
    expect(isDestinationAheadAfterPickup({ direction: 'forward', pickupProgressM: 500, destinationProgressM: 200 })).toBe(false);
    expect(isDestinationAheadAfterPickup({ direction: 'reverse', pickupProgressM: 500, destinationProgressM: 200 })).toBe(true);
    expect(isDestinationAheadAfterPickup({ direction: 'unknown', pickupProgressM: 500, destinationProgressM: 900 })).toBe(false);
  });

  it('calculates course over ground and automatically reverses at a terminal', () => {
    expect(bearingDegrees({ lat: 6.67, lng: -1.57 }, { lat: 6.68, lng: -1.57 })).toBeCloseTo(0, 1);
    expect(resolveEffectiveDirection({ direction: 'forward', drivingStatus: 'STATIONARY', progressM: 1950, routeLengthM: 2000 })).toBe('reverse');
    expect(resolveEffectiveDirection({ direction: 'reverse', drivingStatus: 'STATIONARY', progressM: 50, routeLengthM: 2000 })).toBe('forward');
    expect(resolveEffectiveDirection({ direction: 'forward', drivingStatus: 'STATIONARY', progressM: 900, routeLengthM: 2000 })).toBe('forward');
  });
});
