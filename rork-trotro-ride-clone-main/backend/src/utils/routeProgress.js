const EARTH_M_PER_DEG_LAT = 111320;
const MIN_DIRECTION_MOVEMENT_M = 20;
const MAX_ROUTE_OFFSET_M = 250;

const toXY = (point, referenceLat) => ({
  x: Number(point.lng) * EARTH_M_PER_DEG_LAT * Math.cos(referenceLat * Math.PI / 180),
  y: Number(point.lat) * EARTH_M_PER_DEG_LAT,
});

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

function projectOntoRoute(point, routeStops) {
  if (!point || !Array.isArray(routeStops) || routeStops.length < 2) return null;
  const referenceLat = Number(point.lat);
  const p = toXY(point, referenceLat);
  const stops = routeStops.map((stop) => toXY(stop, referenceLat));
  let travelled = 0;
  let best = null;

  for (let index = 0; index < stops.length - 1; index += 1) {
    const start = stops[index];
    const end = stops[index + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    const segmentLength = Math.sqrt(lengthSquared);
    if (segmentLength === 0) continue;
    const rawT = ((p.x - start.x) * dx + (p.y - start.y) * dy) / lengthSquared;
    const t = Math.max(0, Math.min(1, rawT));
    const projected = { x: start.x + t * dx, y: start.y + t * dy };
    const offsetM = distance(p, projected);
    if (!best || offsetM < best.offsetM) {
      best = {
        progressM: travelled + t * segmentLength,
        offsetM,
        segmentIndex: index,
      };
    }
    travelled += segmentLength;
  }

  return best ? { ...best, routeLengthM: travelled } : null;
}

function deriveMovementState({ previousProgressM, previousPingAt, previousDirection = 'unknown', previousConfidence = 0, currentProjection, now = new Date() }) {
  if (!currentProjection) {
    return { direction: previousDirection, confidence: previousConfidence, progressM: null, offsetM: null, speedMps: null };
  }
  const base = {
    direction: previousDirection,
    confidence: previousConfidence,
    progressM: currentProjection.progressM,
    offsetM: currentProjection.offsetM,
    speedMps: null,
  };
  if (currentProjection.offsetM > MAX_ROUTE_OFFSET_M || previousProgressM == null || !previousPingAt) return base;

  const elapsedSeconds = Math.max(1, (now.getTime() - new Date(previousPingAt).getTime()) / 1000);
  const deltaM = currentProjection.progressM - Number(previousProgressM);
  base.speedMps = Math.abs(deltaM) / elapsedSeconds;
  if (Math.abs(deltaM) < MIN_DIRECTION_MOVEMENT_M) return base;

  const observedDirection = deltaM > 0 ? 'forward' : 'reverse';
  if (previousDirection === 'unknown') {
    return { ...base, direction: observedDirection, confidence: 1 };
  }
  if (previousDirection === observedDirection) {
    return { ...base, confidence: Math.min(5, previousConfidence + 1) };
  }
  if (previousConfidence <= 1) {
    return { ...base, direction: observedDirection, confidence: 1 };
  }
  return { ...base, confidence: previousConfidence - 1 };
}

function isStopAhead({ direction, confidence, busProgressM, stopProgressM, toleranceM = 75 }) {
  if (!Number.isFinite(busProgressM) || !Number.isFinite(stopProgressM) || direction === 'unknown' || confidence < 1) return true;
  return direction === 'forward'
    ? stopProgressM >= busProgressM - toleranceM
    : stopProgressM <= busProgressM + toleranceM;
}

function isDestinationAheadAfterPickup({ direction, pickupProgressM, destinationProgressM, toleranceM = 25 }) {
  if (!Number.isFinite(pickupProgressM) || !Number.isFinite(destinationProgressM)) return false;
  if (direction === 'forward') return destinationProgressM > pickupProgressM + toleranceM;
  if (direction === 'reverse') return destinationProgressM < pickupProgressM - toleranceM;
  return false;
}

module.exports = {
  projectOntoRoute,
  deriveMovementState,
  isStopAhead,
  isDestinationAheadAfterPickup,
  MIN_DIRECTION_MOVEMENT_M,
  MAX_ROUTE_OFFSET_M,
};
