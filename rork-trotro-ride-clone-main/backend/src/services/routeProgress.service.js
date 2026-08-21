const busModel = require('../models/bus.model');
const { projectOntoRoute, deriveMovementState, bearingDegrees, MIN_DIRECTION_MOVEMENT_M } = require('../utils/routeProgress');

async function calculateMovementState(bus, { lat, lng }, client) {
  if (!bus?.route_id) {
    return { direction: 'unknown', confidence: 0, progressM: null, offsetM: null, speedMps: null };
  }
  const routeStops = await busModel.listRouteStops(bus.route_id, client);
  const currentProjection = projectOntoRoute({ lat, lng }, routeStops);
  const movement = deriveMovementState({
    previousProgressM: bus.route_progress_m,
    previousPingAt: bus.last_ping_at,
    previousDirection: bus.route_direction || 'unknown',
    previousConfidence: Number(bus.direction_confidence || 0),
    currentProjection,
  });
  const progressDelta = bus.route_progress_m == null || movement.progressM == null
    ? 0
    : Math.abs(movement.progressM - Number(bus.route_progress_m));
  const hasReliableMovement = progressDelta >= MIN_DIRECTION_MOVEMENT_M && currentProjection?.offsetM <= 250;
  return {
    ...movement,
    headingDeg: hasReliableMovement
      ? bearingDegrees({ lat: bus.current_lat, lng: bus.current_lng }, { lat, lng })
      : bus.movement_heading_deg ?? null,
    directionObservedAt: hasReliableMovement
      ? new Date().toISOString()
      : bus.direction_observed_at ?? null,
  };
}

module.exports = { calculateMovementState };
