const { query } = require('../config/db');
const busModel = require('../models/bus.model');
const bookingModel = require('../models/booking.model');
const walletModel = require('../models/wallet.model');
const push = require('./push.service');
const { ApiError } = require('../utils/ApiError');
const { emitToBus, emitToRoute, emitToUser } = require('../realtime/io');
const routeProgressService = require('./routeProgress.service');
const noShowPickupRadiusM = Math.min(500, Math.max(25, Number(process.env.NO_SHOW_PICKUP_RADIUS_M) || 150));

const getMyBus = async (driverId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `SELECT b.*, r.name AS route_name, r.origin, r.destination
     FROM buses b
     LEFT JOIN routes r ON r.id = b.route_id
     WHERE b.driver_id = $1 AND b.status IN ('active', 'paused')
     ORDER BY b.created_at DESC, b.id DESC
     LIMIT 1`,
    [driverId]
  );
  return rows[0] || null;
};

const getProfile = async (driverId) => {
  const { rows } = await query(
    `SELECT d.*, p.full_name, p.phone, p.email, p.avatar_url
     FROM drivers d
     JOIN profiles p ON p.id = d.id
     WHERE d.id = $1`,
    [driverId]
  );
  if (!rows[0]) throw ApiError.notFound('Driver profile not found');
  const bus = await getMyBus(driverId);
  return { ...rows[0], bus };
};

const getDashboard = async (driverId) => {
  const bus = await getMyBus(driverId);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [tripsRes, pendingRes, wallet] = await Promise.all([
    query(
      `SELECT COUNT(*) AS count FROM bookings
       WHERE driver_id = $1 AND status = 'completed' AND completed_at >= $2`,
      [driverId, today.toISOString()]
    ),
    query(
      `SELECT COUNT(*) AS count FROM bookings
       WHERE driver_id = $1 AND status = 'pending'`,
      [driverId]
    ),
    walletModel.getBalance(driverId),
  ]);

  const { rows: driverRows } = await query(
    `SELECT full_name, rating_avg, rating_count FROM drivers WHERE id = $1`,
    [driverId]
  );
  const driver = driverRows[0];

  return {
    driver_name: driver?.full_name || '',
    rating_avg: parseFloat(driver?.rating_avg || 0),
    rating_count: parseInt(driver?.rating_count || 0, 10),
    bus_registration: bus?.registration || null,
    is_available: bus?.status === 'active',
    driving_status: bus?.driving_status || 'STATIONARY',
    available_seats: bus?.seats_available ?? 0,
    total_seats: bus?.total_seats ?? 14,
    assigned_route: bus?.route_name || null,
    route_origin: bus?.origin || null,
    route_destination: bus?.destination || null,
    todays_trips: parseInt(tripsRes.rows[0]?.count || 0, 10),
    pending_booking_count: parseInt(pendingRes.rows[0]?.count || 0, 10),
    wallet_balance: parseFloat(wallet?.balance || 0),
    bus_id: bus?.id || null,
    route_id: bus?.route_id || null,
  };
};

const setAvailability = async (driverId, isAvailable, client) => {
  const runner = client || { query };
  const bus = await getMyBus(driverId, client);
  if (!bus) throw ApiError.notFound('No bus assigned to this driver yet');
  // entity_status enum: active | paused | deleted
  const newStatus = isAvailable ? 'active' : 'paused';
  const newDrivingStatus = isAvailable ? bus.driving_status : 'STATIONARY';
  const { rows } = await runner.query(
    `UPDATE buses
        SET status = $1,
            driving_status = $2
      WHERE id = $3 RETURNING *`,
    [newStatus, newDrivingStatus, bus.id]
  );
  return rows[0];
};

const setDrivingStatus = async (driverId, drivingStatus, client) => {
  const runner = client || { query };
  if (!['STATIONARY', 'EN_ROUTE'].includes(drivingStatus)) {
    throw ApiError.badRequest('Driving status must be STATIONARY or EN_ROUTE');
  }
  const bus = await getMyBus(driverId, client);
  if (!bus) throw ApiError.notFound('No bus assigned to this driver yet');
  if (bus.status !== 'active' && drivingStatus === 'EN_ROUTE') {
    throw ApiError.conflict('Driver must be available before going en route');
  }
  if (drivingStatus === 'EN_ROUTE' && bus.seats_available <= 0) {
    throw ApiError.conflict('No seats available');
  }
  const { rows } = await runner.query(
    `UPDATE buses SET driving_status = $1 WHERE id = $2 RETURNING *`,
    [drivingStatus, bus.id],
  );
  return rows[0];
};
const updateSeats = async (driverId, { availableSeats, totalSeats }) => {
  const bus = await getMyBus(driverId);
  if (!bus) throw ApiError.notFound('No active bus assigned to this driver');
  const effectiveTotal = totalSeats ?? bus.total_seats;
  const effectiveAvailable = availableSeats ?? bus.seats_available;
  if (!Number.isInteger(effectiveTotal) || effectiveTotal <= 0) {
    throw ApiError.badRequest('Total seats must be a positive integer');
  }
  if (!Number.isInteger(effectiveAvailable) || effectiveAvailable < 0 || effectiveAvailable > effectiveTotal) {
    throw ApiError.badRequest('Available seats must be between 0 and total seats');
  }
  const fields = [];
  const values = [];
  let i = 1;
  if (availableSeats !== undefined) { fields.push(`seats_available = $${i++}`); values.push(availableSeats); }
  if (totalSeats !== undefined) { fields.push(`total_seats = $${i++}`); values.push(totalSeats); }
  if (!fields.length) throw ApiError.badRequest('No seat fields provided');
  values.push(bus.id);
  const { rows } = await query(
    `UPDATE buses SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0];
};

const publishLocationSideEffects = async ({ event, arrivals = [] }) => {
  emitToBus(event.busId, 'bus:location', event);
  if (event.routeId) emitToRoute(event.routeId, 'bus:location', event);
  for (const arrival of arrivals) {
    const payload = {
      bookingId: arrival.id,
      arrivedAt: arrival.arrived_at,
      destinationStopName: arrival.destination_stop_name,
    };
    emitToUser(arrival.passenger_id, 'booking:arrived', payload);
    setImmediate(async () => {
      try {
        if (arrival.passenger_push_token) {
          await push.send(arrival.passenger_push_token, {
            title: 'You have arrived',
            body: `Confirm arrival at ${arrival.destination_stop_name} when you are ready to pay.`,
            data: { type: 'booking_arrived', ...payload },
          });
        }
      } catch (error) {
        console.error('[driver-location] arrival push failed:', error.message);
      }
    });
  }
};

const updateLocation = async (driverId, { lat, lng }, { client, deferSideEffects = false } = {}) => {
  const bus = await getMyBus(driverId, client);
  if (!bus) throw ApiError.notFound('No active bus assigned to this driver');
  if (bus.status !== 'active') {
    throw ApiError.conflict('Location sharing is disabled while the driver is unavailable');
  }
  const movementState = await routeProgressService.calculateMovementState(bus, { lat, lng }, client);
  const updated = await busModel.updateLocation(bus.id, { lat, lng, movementState }, client);
  const pickupArrivals = client
    ? await bookingModel.detectPickupArrivals(driverId, { lat, lng, radiusM: noShowPickupRadiusM }, client)
    : await bookingModel.detectPickupArrivals(driverId, { lat, lng, radiusM: noShowPickupRadiusM });

  const event = { busId: updated.id, routeId: updated.route_id, lat, lng, driverId, ts: Date.now() };

  // The driver app reports through this endpoint (not /buses/:id/location),
  // so destination detection must run here as part of the same GPS update.
  // Await the spatial update so a passenger refresh immediately sees
  // arrived_at; push delivery remains non-blocking.
  const arrivals = client
    ? await bookingModel.detectDestinationArrivals(driverId, { lat, lng }, client)
    : await bookingModel.detectDestinationArrivals(driverId, { lat, lng });
  if (deferSideEffects) return {
    updated,
    sideEffects: { event, pickupArrivals, arrivals },
  };
  await publishLocationSideEffects({ event, arrivals });
  return updated;
};

const updateRoute = async (driverId, routeId) => {
  const bus = await getMyBus(driverId);
  if (!bus) throw ApiError.notFound('No active bus assigned to this driver');
  // Verify the route exists
  const { rows: routeRows } = await query(
    `SELECT id FROM routes WHERE id = $1 AND status = 'active'`,
    [routeId]
  );
  if (!routeRows[0]) throw ApiError.notFound('Route not found');
  const { rows } = await query(
    `UPDATE buses
        SET route_id = $1, route_direction = 'unknown', route_progress_m = null,
            route_offset_m = null, movement_speed_mps = null, movement_heading_deg = null,
            direction_confidence = 0, direction_observed_at = null
      WHERE id = $2 RETURNING *`,
    [routeId, bus.id]
  );
  return rows[0];
};

module.exports = {
  getProfile, getDashboard, setAvailability, setDrivingStatus, updateSeats,
  updateLocation, publishLocationSideEffects, updateRoute, getMyBus,
};
