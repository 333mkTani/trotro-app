const { query } = require('../config/db');

const COLUMNS = `id, passenger_id, driver_id, bus_id, route_id,
  pickup_stop_id, pickup_stop_name, destination_stop_id, destination_stop_name,
  desired_arrival_time, buffer_minutes, status,
  notification_sent_at, confirmed_at, completed_at, cancelled_at,
  arrival_near_at, arrived_at, expired_at,
  boarded_at, paid_at,
  route_name, ride_fare, ride_payment_method, ride_schedule,
  created_at, updated_at`;

const findById = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(`select ${COLUMNS} from public.bookings where id = $1`, [id]);
  return rows[0] || null;
};

const listForPassenger = async (passengerId, { status } = {}) => {
  if (status) {
    const { rows } = await query(
      `select ${COLUMNS} from public.bookings
        where passenger_id = $1 and status = $2
        order by created_at desc`,
      [passengerId, status],
    );
    return rows;
  }
  const { rows } = await query(
    `select ${COLUMNS} from public.bookings where passenger_id = $1 order by created_at desc`,
    [passengerId],
  );
  return rows;
};

// Bookings this driver can see: ones already assigned to them, plus (when
// checking 'pending') unclaimed same-route requests any driver on that
// route may accept via POST /bookings/:id/confirm.
const listForDriver = async (driverId, { status, routeId } = {}) => {
  if (status === 'pending' && routeId) {
    const { rows } = await query(
      `select ${COLUMNS} from public.bookings
        where status = 'pending'
          and (driver_id = $1 or (driver_id is null and route_id = $2))
        order by created_at desc`,
      [driverId, routeId],
    );
    return rows;
  }
  if (status) {
    const { rows } = await query(
      `select ${COLUMNS} from public.bookings
        where driver_id = $1 and status = $2
        order by created_at desc`,
      [driverId, status],
    );
    return rows;
  }
  const { rows } = await query(
    `select ${COLUMNS} from public.bookings where driver_id = $1 order by created_at desc`,
    [driverId],
  );
  return rows;
};

const insert = async (data, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `insert into public.bookings (
       passenger_id, driver_id, bus_id, route_id,
       pickup_stop_id, pickup_stop_name, destination_stop_id, destination_stop_name,
       desired_arrival_time, buffer_minutes, status,
       route_name, ride_fare, ride_payment_method, ride_schedule
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15
     ) returning ${COLUMNS}`,
    [
      data.passengerId,
      data.driverId || null,
      data.busId || null,
      data.routeId || null,
      data.pickupStopId,
      data.pickupStopName,
      data.destinationStopId,
      data.destinationStopName,
      data.desiredArrivalTime,
      data.bufferMinutes,
      data.status || 'pending',
      data.routeName || null,
      data.rideFare || null,
      data.ridePaymentMethod || null,
      data.rideSchedule ? JSON.stringify(data.rideSchedule) : null,
    ],
  );
  return rows[0];
};

const updateStatus = async (id, status, extra = {}, client) => {
  const runner = client || { query };
  const fields = ['status = $2'];
  const values = [id, status];
  let i = 3;
  if (extra.driverId !== undefined) { fields.push(`driver_id = $${i++}`); values.push(extra.driverId); }
  if (extra.busId !== undefined) { fields.push(`bus_id = $${i++}`); values.push(extra.busId); }
  if (status === 'confirmed') fields.push(`confirmed_at = now()`);
  if (status === 'completed') fields.push(`completed_at = now()`);
  if (status === 'cancelled') fields.push(`cancelled_at = now()`);

  const { rows } = await runner.query(
    `update public.bookings set ${fields.join(', ')}
      where id = $1 returning ${COLUMNS}`,
    values,
  );
  return rows[0] || null;
};

// Returns confirmed bookings for a driver that haven't had a proximity notification sent yet.
// Joins bus_stops for stop coords and profiles for the passenger's push token.
const listConfirmedForDriverUnnotified = async (driverId) => {
  const { rows } = await query(
    `SELECT b.id, b.passenger_id, b.pickup_stop_id,
            s.lat AS stop_lat, s.lng AS stop_lng,
            p.fcm_token AS passenger_push_token,
            b.route_name, b.pickup_stop_name
       FROM public.bookings b
       JOIN public.bus_stops s ON s.id = b.pickup_stop_id
       JOIN public.profiles p ON p.id = b.passenger_id
      WHERE b.driver_id = $1
        AND b.status = 'confirmed'
        AND b.notification_sent_at IS NULL`,
    [driverId],
  );
  return rows;
};

const markNotified = async (id) => {
  await query(
    `UPDATE public.bookings SET notification_sent_at = now() WHERE id = $1`,
    [id],
  );
};

// Requires two proximity pings at least ten seconds apart. Leaving the radius
// resets the first observation, so merely passing nearby once is not enough.
const detectDestinationArrivals = async (driverId, { lat, lng, radiusM = 150 }) => {
  await query(
    `UPDATE public.bookings b
        SET arrival_near_at = NULL
       FROM public.bus_stops s
      WHERE b.destination_stop_id = s.id
        AND b.driver_id = $1
        AND b.status = 'confirmed'
        AND b.arrived_at IS NULL
        AND b.arrival_near_at IS NOT NULL
        AND NOT ST_DWithin(
          s.geom::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          $4
        )`,
    [driverId, lng, lat, radiusM],
  );

  const { rows } = await query(
    `UPDATE public.bookings b
        SET arrived_at = CASE
              WHEN b.arrival_near_at <= now() - interval '10 seconds' THEN now()
              ELSE b.arrived_at
            END,
            arrival_near_at = coalesce(b.arrival_near_at, now())
       FROM public.bus_stops s, public.profiles p
      WHERE b.destination_stop_id = s.id
        AND p.id = b.passenger_id
        AND b.driver_id = $1
        AND b.status = 'confirmed'
        AND b.arrived_at IS NULL
        AND EXISTS (
          SELECT 1 FROM public.verification_codes vc
           WHERE vc.booking_id = b.id AND vc.status = 'used'
        )
        AND ST_DWithin(
          s.geom::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          $4
        )
      RETURNING b.id, b.passenger_id, b.destination_stop_name,
                b.pickup_stop_name, b.route_name, b.arrived_at,
                p.fcm_token AS passenger_push_token`,
    [driverId, lng, lat, radiusM],
  );
  return rows.filter((row) => row.arrived_at);
};

const expireStaleConfirmed = async (olderThanHours = 4, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `UPDATE public.bookings
        SET status = 'expired', expired_at = now()
      WHERE status = 'confirmed'
        AND confirmed_at < now() - ($1 * interval '1 hour')
      RETURNING ${COLUMNS}`,
    [olderThanHours],
  );
  return rows;
};

const findForPaymentForUpdate = async (id, passengerId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `SELECT b.*, r.fare AS authoritative_fare, vc.status AS code_status
       FROM public.bookings b
       JOIN public.buses bus ON bus.id = b.bus_id
       JOIN public.routes r ON r.id = coalesce(b.route_id, bus.route_id)
       LEFT JOIN public.verification_codes vc ON vc.booking_id = b.id
      WHERE b.id = $1 AND b.passenger_id = $2
      FOR UPDATE OF b`,
    [id, passengerId],
  );
  return rows[0] || null;
};

const markBoarded = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.bookings set boarded_at = coalesce(boarded_at, now())
      where id = $1 returning ${COLUMNS}`,
    [id],
  );
  return rows[0] || null;
};

const markPaid = async (id, paymentMethod, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.bookings
        set paid_at = coalesce(paid_at, now()), ride_payment_method = $2
      where id = $1 returning ${COLUMNS}`,
    [id, paymentMethod],
  );
  return rows[0] || null;
};

module.exports = {
  findById, listForPassenger, listForDriver, insert, updateStatus,
  listConfirmedForDriverUnnotified, markNotified,
  detectDestinationArrivals, expireStaleConfirmed, findForPaymentForUpdate,
  markBoarded, markPaid,
};
