const busModel = require('../models/bus.model');
const { projectOntoRoute, deriveMovementState } = require('../utils/routeProgress');

async function calculateMovementState(bus, { lat, lng }) {
  if (!bus?.route_id) {
    return { direction: 'unknown', confidence: 0, progressM: null, offsetM: null, speedMps: null };
  }
  const routeStops = await busModel.listRouteStops(bus.route_id);
  const currentProjection = projectOntoRoute({ lat, lng }, routeStops);
  return deriveMovementState({
    previousProgressM: bus.route_progress_m,
    previousPingAt: bus.last_ping_at,
    previousDirection: bus.route_direction || 'unknown',
    previousConfidence: Number(bus.direction_confidence || 0),
    currentProjection,
  });
}

module.exports = { calculateMovementState };
