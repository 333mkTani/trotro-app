const model = require('../models/departureSlot.model');
const driverProfile = require('./driverProfile.service');
const { ApiError } = require('../utils/ApiError');

const listMine = (driverId) => model.listForDriver(driverId);
const listPublished = (filters) => model.listPublished(filters);

const create = async (driverId, data) => {
  const bus = await driverProfile.getMyBus(driverId);
  if (!bus) throw ApiError.notFound('No bus assigned to this driver');
  if (bus.route_id !== data.routeId) throw ApiError.badRequest('Slot route must match the bus assigned route');
  if (!await model.routeContainsStops(data.routeId, data.departureStopId, data.destinationStopId)) {
    throw ApiError.badRequest('Both departure stations must belong to the assigned route');
  }
  return model.insert(driverId, bus.id, data);
};

const remove = async (id, driverId) => {
  const slot = await model.remove(id, driverId);
  if (!slot) throw ApiError.notFound('Departure slot not found');
  return { ok: true };
};

module.exports = { listMine, listPublished, create, remove };
