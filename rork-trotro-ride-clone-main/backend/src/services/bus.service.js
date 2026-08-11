const busModel = require('../models/bus.model');
const bookingModel = require('../models/booking.model');
const cache = require('./cache.service');
const push = require('./push.service');
const { publisher, isReady } = require('../config/redis');
const { ApiError } = require('../utils/ApiError');
const { emitToBus, emitToRoute, emitToUser } = require('../realtime/io');
const routeProgressService = require('./routeProgress.service');
const {
  projectOntoRoute, isStopAhead, isDestinationAheadAfterPickup, resolveEffectiveDirection,
} = require('../utils/routeProgress');

const APPROACH_RADIUS_M = 500;
const AVG_SPEED_MPS = 6.9; // ~25 km/h average city driving speed, for ETA estimates
const PARKED_PICKUP_RADIUS_M = 100;
const HEADING_LOCK_TTL_MS = 45 * 60 * 1000;

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const ITEM_KEY = (id) => `buses:item:${id}`;
const LOC_KEY = (id) => `buses:loc:${id}`;
const LOCATION_TTL = 30; // seconds — last-known cache window

const list = (opts) => busModel.list(opts);

const getById = async (id) => {
  const bus = await cache.wrap(ITEM_KEY(id), 30, () => busModel.findById(id));
  if (!bus) throw ApiError.notFound('Bus not found');
  return bus;
};

const create = (data) => busModel.insert(data);

const updateLocation = async (id, coords) => {
  const existing = await busModel.findById(id);
  if (!existing) throw ApiError.notFound('Bus not found');
  const movementState = await routeProgressService.calculateMovementState(existing, coords);
  const updated = await busModel.updateLocation(id, { ...coords, movementState });
  if (!updated) throw ApiError.notFound('Bus not found');

  // Cache last-known location and broadcast to live subscribers.
  await cache.set(LOC_KEY(id), {
    busId: id,
    lat: coords.lat,
    lng: coords.lng,
    at: new Date().toISOString(),
  }, LOCATION_TTL);
  await cache.del(ITEM_KEY(id));

  const event = { busId: id, routeId: updated.route_id, lat: coords.lat, lng: coords.lng, ts: Date.now() };
  emitToBus(id, 'bus:location', event);
  if (updated.route_id) emitToRoute(updated.route_id, 'bus:location', event);

  if (isReady()) {
    try {
      await publisher.publish(
        `bus:${id}:location`,
        JSON.stringify({ busId: id, lat: coords.lat, lng: coords.lng, at: Date.now() }),
      );
    } catch (err) {
      console.error('[bus] publish failed', err.message);
    }
  }

  // Non-blocking: check if any booked passengers should be notified
  if (updated.driver_id) {
    setImmediate(async () => {
      try {
        const bookings = await bookingModel.listConfirmedForDriverUnnotified(updated.driver_id);
        for (const b of bookings) {
          const dist = haversineM(
            Number(coords.lat), Number(coords.lng),
            parseFloat(b.stop_lat), parseFloat(b.stop_lng),
          );
          if (dist <= APPROACH_RADIUS_M) {
            await push.send(b.passenger_push_token, {
              title: '🚌 Your bus is approaching!',
              body: `Head to ${b.pickup_stop_name} now — bus is ${Math.round(dist)}m away.`,
              data: { type: 'bus_approaching', bookingId: b.id },
            });
            await bookingModel.markNotified(b.id);
            console.log(`[bus] notified passenger for booking ${b.id}, dist ${Math.round(dist)}m`);
          }
        }

        const arrivals = await bookingModel.detectDestinationArrivals(
          updated.driver_id,
          { lat: coords.lat, lng: coords.lng },
        );
        for (const arrival of arrivals) {
          const payload = {
            bookingId: arrival.id,
            arrivedAt: arrival.arrived_at,
            destinationStopName: arrival.destination_stop_name,
          };
          emitToUser(arrival.passenger_id, 'booking:arrived', payload);
          await push.send(arrival.passenger_push_token, {
            title: 'You have arrived',
            body: `Confirm arrival at ${arrival.destination_stop_name} when you are ready to pay.`,
            data: { type: 'booking_arrived', ...payload },
          });
          console.log(`[bus] destination arrival detected for booking ${arrival.id}`);
        }
      } catch (err) {
        console.error('[bus] proximity notify failed:', err.message);
      }
    });
  }

  return updated;
};

/** Spatial: live buses near a coordinate via PostGIS. */
const nearby = ({ lat, lng, radiusM, routeId, limit }) =>
  busModel.findNearby({ lat, lng, radiusM, routeId, limit });

const listActive = () => busModel.listActive();

/** Active buses approaching a stop, nearest-first, with a real ETA derived from distance. */
const listApproachingStop = async ({ stopId, destinationStopId, routeName }) => {
  const rows = await busModel.listApproachingStop({ stopId, routeName });
  const routeStopsById = new Map();
  await Promise.all([...new Set(rows.map((row) => row.route_id).filter(Boolean))].map(async (routeId) => {
    routeStopsById.set(routeId, await busModel.listRouteStops(routeId));
  }));

  return rows.map((b) => {
    const stops = routeStopsById.get(b.route_id) || [];
    const stop = stops.find((item) => item.id === stopId);
    const stopProjection = stop ? projectOntoRoute(stop, stops) : null;
    const stopProgressM = stopProjection?.progressM ?? null;
    const destination = destinationStopId ? stops.find((item) => item.id === destinationStopId) : null;
    const destinationProgressM = destination ? projectOntoRoute(destination, stops)?.progressM : null;
    const distanceM = b.distance_m != null ? Number(b.distance_m) : null;
    const isParkedAtPickup = b.driving_status === 'STATIONARY'
      && distanceM != null && distanceM <= PARKED_PICKUP_RADIUS_M;
    if (b.driving_status === 'STATIONARY' && !isParkedAtPickup) return null;

    const lockedAt = b.direction_observed_at ? new Date(b.direction_observed_at).getTime() : 0;
    const hasFreshLock = lockedAt > 0 && Date.now() - lockedAt <= HEADING_LOCK_TTL_MS;
    const rawProgressM = b.route_progress_m == null ? null : Number(b.route_progress_m);
    const effectiveDirection = resolveEffectiveDirection({
      direction: b.route_direction,
      drivingStatus: b.driving_status,
      progressM: rawProgressM,
      routeLengthM: stopProjection?.routeLengthM,
    });
    const terminalDirectionInferred = effectiveDirection !== b.route_direction;
    const hasKnownDirection = ['forward', 'reverse'].includes(effectiveDirection)
      && Number(b.direction_confidence || 0) >= 1;
    if (!hasKnownDirection && !terminalDirectionInferred) return null;
    if (isParkedAtPickup && !hasFreshLock && !terminalDirectionInferred) return null;
    const approaching = isStopAhead({
      direction: effectiveDirection,
      confidence: terminalDirectionInferred ? 1 : Number(b.direction_confidence || 0),
      busProgressM: rawProgressM,
      stopProgressM: stopProgressM == null ? null : Number(stopProgressM),
    });
    if (!approaching) return null;
    if (destinationStopId && !isDestinationAheadAfterPickup({
      direction: effectiveDirection,
      pickupProgressM: stopProgressM,
      destinationProgressM,
    })) return null;
    const remainingRouteM = Number.isFinite(stopProgressM) && Number.isFinite(Number(b.route_progress_m))
      ? Math.abs(stopProgressM - Number(b.route_progress_m))
      : distanceM;
    const speedMps = Number(b.movement_speed_mps);
    const effectiveSpeedMps = Number.isFinite(speedMps) && speedMps >= 2 ? Math.min(speedMps, 20) : AVG_SPEED_MPS;
    return {
      ...b,
      distance_m: distanceM != null ? Math.round(distanceM) : null,
      route_distance_to_stop_m: remainingRouteM != null ? Math.round(remainingRouteM) : null,
      eta_minutes: isParkedAtPickup ? 0 : (remainingRouteM != null ? Math.max(1, Math.round(remainingRouteM / effectiveSpeedMps / 60)) : 5),
      effective_direction: effectiveDirection,
      arrival_state: isParkedAtPickup ? 'boarding_now' : 'approaching',
      is_approaching: !isParkedAtPickup,
    };
  }).filter(Boolean).sort((a, b) => a.eta_minutes - b.eta_minutes);
};

/** Returns the latest GPS position for a driver's bus.
 *  Checks Redis cache first (updated every GPS ping) then falls back to DB. */
const getDriverLocation = async (driverId) => {
  const bus = await busModel.findByDriverId(driverId);
  if (!bus) throw ApiError.notFound('Bus not found for driver');

  // Try Redis cache for freshest reading
  const cached = await cache.get(LOC_KEY(bus.id));
  if (cached) {
    return {
      bus_id: bus.id,
      lat: cached.lat,
      lng: cached.lng,
      seats_available: bus.seats_available,
      last_ping_at: cached.at,
    };
  }

  return {
    bus_id: bus.id,
    lat: bus.current_lat,
    lng: bus.current_lng,
    seats_available: bus.seats_available,
    last_ping_at: bus.last_ping_at,
  };
};

module.exports = {
  list, getById, create, updateLocation, nearby, listActive, getDriverLocation,
  listApproachingStop,
};
