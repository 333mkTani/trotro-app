const { query } = require('../config/db');

const COLUMNS = `id, passenger_id, driver_id, bus_id, route_id,
  pickup_stop_id, pickup_stop_name, destination_stop_id, destination_stop_name,
  desired_arrival_time, buffer_minutes, status,
  notification_sent_at, confirmed_at, completed_at, cancelled_at,
  arrival_near_at, arrived_at, expired_at,
  boarded_at, paid_at,
  route_name, ride_fare, ride_payment_method, ride_schedule, source_occurrence_id,
  payment_status, total_fare, deposit_amount, remaining_balance,
  boarding_deadline, cancellation_deadline, no_show_marked_at, hold_expires_at,
  driver_pickup_arrived_at, no_show_compensation_amount, no_show_compensated_at,
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
       route_name, ride_fare, ride_payment_method, ride_schedule, source_occurrence_id
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16
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
      data.sourceOccurrenceId || null,
    ],
  );
  return rows[0];
};

const passengerCanTrackDriver = async (passengerId, driverId) => {
  const { rows } = await query(
    `select exists(
       select 1
         from public.bookings
        where passenger_id = $1
          and driver_id = $2
          and status = 'confirmed'
     ) as allowed`,
    [passengerId, driverId],
  );
  return rows[0]?.allowed === true;
};

const lockBusForProvisionalHold = async (busId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select id, driver_id, route_id, status, driving_status, seats_available
       from public.buses
      where id = $1
      for update`,
    [busId],
  );
  return rows[0] || null;
};

const countActiveProvisionalHolds = async (busId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select count(*)::integer as count
       from public.bookings
      where bus_id = $1
        and status = 'pending'
        and payment_status = 'deposit_pending'
        and hold_expires_at > now()`,
    [busId],
  );
  return rows[0]?.count || 0;
};

const findActiveProvisionalHold = async (passengerId, busId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select ${COLUMNS}
       from public.bookings
      where passenger_id = $1
        and bus_id = $2
        and status = 'pending'
        and payment_status = 'deposit_pending'
        and hold_expires_at > now()
      order by created_at desc
      limit 1`,
    [passengerId, busId],
  );
  return rows[0] || null;
};

const insertProvisional = async (data, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `insert into public.bookings (
       passenger_id, driver_id, bus_id, route_id,
       pickup_stop_id, pickup_stop_name, destination_stop_id, destination_stop_name,
       desired_arrival_time, buffer_minutes, status, route_name,
       ride_fare, total_fare, deposit_amount, remaining_balance,
       payment_status, hold_expires_at, boarding_deadline, cancellation_deadline
     ) values (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11,
       $12,$12,$13,$14,'deposit_pending',$15,$16,$17
     ) returning ${COLUMNS}`,
    [
      data.passengerId, data.driverId, data.busId, data.routeId,
      data.pickupStopId, data.pickupStopName,
      data.destinationStopId, data.destinationStopName,
      data.desiredArrivalTime, data.bufferMinutes, data.routeName,
      data.totalFare, data.depositAmount, data.remainingBalance, data.holdExpiresAt,
      data.boardingDeadline, data.cancellationDeadline,
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

// Records authoritative GPS evidence that the assigned driver reached the
// passenger's pickup stop. The first observation is retained for no-show
// eligibility even if the driver later leaves the stop.
const detectPickupArrivals = async (driverId, { lat, lng, radiusM = 150 }) => {
  const { rows } = await query(
    `update public.bookings b
        set driver_pickup_arrived_at = coalesce(driver_pickup_arrived_at, now()),
            updated_at = now()
       from public.bus_stops s
      where b.pickup_stop_id = s.id
        and b.driver_id = $1
        and b.status = 'confirmed'
        and b.boarded_at is null
        and b.driver_pickup_arrived_at is null
        and (b.boarding_deadline is null or now() <= b.boarding_deadline)
        and ST_DWithin(
          s.geom::geography,
          ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
          $4
        )
      returning b.id, b.passenger_id, b.driver_id, b.driver_pickup_arrived_at`,
    [driverId, lng, lat, radiusM],
  );
  return rows;
};

// The service locks and validates the booking before calling this update.
// Keep this statement guarded as a second line of defence, but avoid selecting
// and locking the same row again through a writable CTE.
const cancelForUser = async (id, now, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.bookings
        set status = 'cancelled', cancelled_at = coalesce(cancelled_at, $2),
            hold_expires_at = null,
            payment_status = case
              when payment_status = 'deposit_pending' then 'failed'::reservation_payment_status
              when payment_status = 'deposit_paid'
                and (cancellation_deadline is null or $2 <= cancellation_deadline)
                then 'refund_pending'::reservation_payment_status
              else payment_status end,
            updated_at = now()
      where id = $1 and status in ('pending', 'confirmed') and boarded_at is null
      returning ${COLUMNS}`,
    [id, now],
  );
  return rows[0] || null;
};

const expireDue = async (now, legacyHours = 4, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `with due as (
       select id, status as previous_status
         from public.bookings
        where (
          status = 'pending' and payment_status = 'deposit_pending'
          and hold_expires_at <= $1
        ) or (
          status = 'confirmed' and boarded_at is null
          and coalesce(boarding_deadline, confirmed_at + ($2 * interval '1 hour')) <= $1
        )
        for update skip locked
     )
     update public.bookings b
        set status = 'expired', expired_at = coalesce(expired_at, $1),
            no_show_marked_at = case when due.previous_status = 'confirmed'
              then coalesce(b.no_show_marked_at, $1) else b.no_show_marked_at end,
            payment_status = case when b.payment_status = 'deposit_pending'
              then 'failed'::reservation_payment_status else b.payment_status end,
            hold_expires_at = null, updated_at = now()
       from due where b.id = due.id
     returning b.*, due.previous_status`,
    [now, legacyHours],
  );
  return rows;
};

const findProvisionalForPaymentForUpdate = async (id, passengerId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select ${COLUMNS} from public.bookings
      where id = $1 and passenger_id = $2
      for update`,
    [id, passengerId],
  );
  return rows[0] || null;
};

const markDepositPaid = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.bookings
        set payment_status = 'deposit_paid', updated_at = now()
      where id = $1 and payment_status = 'deposit_pending'
      returning ${COLUMNS}`,
    [id],
  );
  return rows[0] || null;
};

const findByIdForUpdate = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select ${COLUMNS} from public.bookings where id = $1 for update`,
    [id],
  );
  return rows[0] || null;
};

const confirmAfterDeposit = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.bookings
        set status = 'confirmed', payment_status = 'deposit_paid',
            confirmed_at = coalesce(confirmed_at, now()),
            hold_expires_at = null, updated_at = now()
      where id = $1 and status = 'pending' and payment_status = 'deposit_pending'
      returning ${COLUMNS}`,
    [id],
  );
  return rows[0] || null;
};

const markDepositRefundPending = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.bookings
        set payment_status = 'refund_pending', hold_expires_at = null,
            updated_at = now()
      where id = $1 and payment_status in ('deposit_pending', 'failed')
      returning ${COLUMNS}`,
    [id],
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

const markBoardedAndOpenBalance = async (id, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.bookings
        set boarded_at = coalesce(boarded_at, now()),
            payment_status = case
              when payment_status = 'deposit_paid' and coalesce(remaining_balance, 0) > 0 then 'balance_pending'::reservation_payment_status
              when payment_status = 'deposit_paid' then 'fully_paid'::reservation_payment_status
              else payment_status end,
            paid_at = case
              when payment_status = 'deposit_paid' and coalesce(remaining_balance, 0) <= 0 then coalesce(paid_at, now())
              else paid_at end,
            updated_at = now()
      where id = $1 returning ${COLUMNS}`,
    [id],
  );
  return rows[0] || null;
};

const markBalancePaid = async (id, paymentMethod, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.bookings
        set payment_status = 'fully_paid', remaining_balance = 0,
            paid_at = coalesce(paid_at, now()),
            ride_payment_method = coalesce($2::ride_payment_method, ride_payment_method),
            updated_at = now()
      where id = $1 and payment_status = 'balance_pending' and boarded_at is not null
      returning ${COLUMNS}`,
    [id, paymentMethod || null],
  );
  return rows[0] || null;
};

const markNoShowCompensated = async (id, amount, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.bookings
        set payment_status = 'deposit_forfeited',
            no_show_compensation_amount = $2,
            no_show_compensated_at = coalesce(no_show_compensated_at, now()),
            updated_at = now()
      where id = $1 and status = 'expired' and no_show_marked_at is not null
        and driver_pickup_arrived_at is not null
        and payment_status = 'deposit_paid'
        and no_show_compensated_at is null
      returning ${COLUMNS}`,
    [id, amount],
  );
  return rows[0] || null;
};

const markRefunded = async (id, amount, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.bookings
        set payment_status = case
              when $2 >= deposit_amount then 'refunded'::reservation_payment_status
              else 'partially_refunded'::reservation_payment_status end,
            updated_at = now()
      where id = $1 and payment_status = 'refund_pending'
      returning ${COLUMNS}`,
    [id, amount],
  );
  return rows[0] || null;
};

const listRefundPending = async (limit = 50) => {
  const { rows } = await query(
    `select ${COLUMNS} from public.bookings
      where payment_status = 'refund_pending'
      order by updated_at asc limit $1`, [limit],
  );
  return rows;
};

module.exports = {
  findById, listForPassenger, passengerCanTrackDriver, listForDriver, insert, updateStatus,
  lockBusForProvisionalHold, countActiveProvisionalHolds,
  findActiveProvisionalHold, insertProvisional,
  listConfirmedForDriverUnnotified, markNotified,
  detectDestinationArrivals, detectPickupArrivals,
  expireStaleConfirmed, cancelForUser, expireDue,
  findForPaymentForUpdate,
  findProvisionalForPaymentForUpdate, findByIdForUpdate,
  markDepositPaid, confirmAfterDeposit, markDepositRefundPending,
  markBoarded, markBoardedAndOpenBalance, markBalancePaid, markPaid,
  markNoShowCompensated,
  markRefunded,
  listRefundPending,
};
