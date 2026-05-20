const { query } = require('../config/db');

const COLUMNS = `id, passenger_id, route_id, route_name, stop_id, stop_name,
  alert_time, schedule, is_active, triggered, last_triggered_day, triggered_buses, created_at`;

const listForPassenger = async (passengerId) => {
  const { rows } = await query(
    `select ${COLUMNS} from public.bus_alerts where passenger_id = $1 order by created_at desc`,
    [passengerId],
  );
  return rows;
};

const findById = async (id) => {
  const { rows } = await query(`select ${COLUMNS} from public.bus_alerts where id = $1`, [id]);
  return rows[0] || null;
};

const insert = async (data) => {
  const { rows } = await query(
    `insert into public.bus_alerts
       (passenger_id, route_id, route_name, stop_id, stop_name, alert_time, schedule, is_active)
     values ($1,$2,$3,$4,$5,$6,$7,coalesce($8,true))
     returning ${COLUMNS}`,
    [
      data.passengerId,
      data.routeId || null,
      data.routeName,
      data.stopId,
      data.stopName,
      data.alertTime || null,
      data.schedule ? JSON.stringify(data.schedule) : null,
      data.isActive,
    ],
  );
  return rows[0];
};

const update = async (id, patch) => {
  const fields = [];
  const values = [];
  let i = 1;
  const map = {
    isActive: 'is_active',
    triggered: 'triggered',
    alertTime: 'alert_time',
    lastTriggeredDay: 'last_triggered_day',
  };
  for (const [key, col] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      fields.push(`${col} = $${i++}`);
      values.push(patch[key]);
    }
  }
  if (patch.schedule !== undefined) {
    fields.push(`schedule = $${i++}`);
    values.push(patch.schedule ? JSON.stringify(patch.schedule) : null);
  }
  if (patch.triggeredBuses !== undefined) {
    fields.push(`triggered_buses = $${i++}`);
    values.push(patch.triggeredBuses ? JSON.stringify(patch.triggeredBuses) : null);
  }
  if (!fields.length) return findById(id);
  values.push(id);
  const { rows } = await query(
    `update public.bus_alerts set ${fields.join(', ')} where id = $${i} returning ${COLUMNS}`,
    values,
  );
  return rows[0] || null;
};

const remove = async (id) => {
  await query(`delete from public.bus_alerts where id = $1`, [id]);
};

module.exports = { listForPassenger, findById, insert, update, remove };
