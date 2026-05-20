const { query } = require('../config/db');
const busModel = require('../models/bus.model');
const walletModel = require('../models/wallet.model');
const { ApiError } = require('../utils/ApiError');

const getMyBus = async (driverId) => {
  const { rows } = await query(
    `SELECT b.*, r.name AS route_name, r.origin, r.destination
     FROM buses b
     LEFT JOIN routes r ON r.id = b.route_id
     WHERE b.driver_id = $1 AND b.status = 'active'
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

const setAvailability = async (driverId, isAvailable) => {
  const bus = await getMyBus(driverId);
  if (!bus) throw ApiError.notFound('No active bus assigned to this driver');
  const newStatus = isAvailable ? 'active' : 'inactive';
  const { rows } = await query(
    `UPDATE buses SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [newStatus, bus.id]
  );
  return rows[0];
};

const updateSeats = async (driverId, { availableSeats, totalSeats }) => {
  const bus = await getMyBus(driverId);
  if (!bus) throw ApiError.notFound('No active bus assigned to this driver');
  const fields = [];
  const values = [];
  let i = 1;
  if (availableSeats !== undefined) { fields.push(`seats_available = $${i++}`); values.push(availableSeats); }
  if (totalSeats !== undefined) { fields.push(`total_seats = $${i++}`); values.push(totalSeats); }
  if (!fields.length) throw ApiError.badRequest('No seat fields provided');
  values.push(bus.id);
  const { rows } = await query(
    `UPDATE buses SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0];
};

const updateLocation = async (driverId, { lat, lng }) => {
  const bus = await getMyBus(driverId);
  if (!bus) throw ApiError.notFound('No active bus assigned to this driver');
  return busModel.updateLocation(bus.id, { lat, lng });
};

module.exports = { getProfile, getDashboard, setAvailability, updateSeats, updateLocation, getMyBus };
