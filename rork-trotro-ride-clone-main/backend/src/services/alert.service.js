const alertModel = require('../models/alert.model');
const { ApiError } = require('../utils/ApiError');
const deliveryModel = require('../models/busAlertDelivery.model');
const routeModel = require('../models/route.model');
const stopModel = require('../models/stop.model');
const observability = require('../utils/observability');
const { isBusAlertsEnabled } = require('../config/busAlertRollout');

const list = (passengerId) => alertModel.listForPassenger(passengerId);

const getById = async (id, user) => {
  const a = await alertModel.findById(id);
  if (!a) throw ApiError.notFound('Alert not found');
  if (user.role !== 'admin' && a.passenger_id !== user.id) throw ApiError.forbidden();
  return a;
};

const validatedConfiguration = async (data) => {
  const stop = await stopModel.findById(data.stopId);
  if (!stop || stop.status !== 'active') throw ApiError.badRequest('Selected stop is unavailable');
  if (!data.routeId) return { routeId: null, routeName: 'Any Route', stopName: stop.name };
  const route = await routeModel.findById(data.routeId);
  if (!route || route.status !== 'active') throw ApiError.badRequest('Selected route is unavailable');
  const stops = await routeModel.findStops(route.id);
  if (!stops.some((item) => item.id === stop.id && item.status === 'active')) {
    throw ApiError.badRequest('Selected stop does not belong to the selected route');
  }
  return { routeId: route.id, routeName: route.name, stopName: stop.name };
};

const create = async (passengerId, data) => {
  if (!isBusAlertsEnabled(passengerId)) throw ApiError.forbidden('Bus alerts are not enabled for this account');
  const canonical = await validatedConfiguration(data);
  const alert = await alertModel.insert({ ...data, ...canonical, passengerId });
  observability.increment('bus_alert.created');
  observability.log('info', 'bus_alert.created', { alertId: alert.id, passengerId });
  return alert;
};

const update = async (id, user, patch) => {
  const current = await getById(id, user);
  const nextAlertTime = patch.alertTime !== undefined ? patch.alertTime : current.alert_time;
  const nextSchedule = patch.schedule !== undefined ? patch.schedule : current.schedule;
  if (!nextAlertTime && !nextSchedule) throw ApiError.badRequest('Alert must keep an alert time or recurring schedule');
  const updated = await alertModel.update(id, patch);
  if (patch.isActive === false) {
    const cancelled = await deliveryModel.cancelPendingForAlert(id);
    observability.increment('bus_alert.cancelled', Math.max(1, cancelled || 0));
    observability.log('info', 'bus_alert.cancelled', { alertId: id, triggerOccurrences: cancelled || 0 });
  }
  return updated;
};

const remove = async (id, user) => {
  await getById(id, user);
  const cancelled = await deliveryModel.cancelPendingForAlert(id);
  observability.increment('bus_alert.cancelled', Math.max(1, cancelled || 0));
  observability.log('info', 'bus_alert.deleted', { alertId: id, triggerOccurrences: cancelled || 0 });
  await alertModel.remove(id);
  return { ok: true };
};

module.exports = { list, getById, create, update, remove };
