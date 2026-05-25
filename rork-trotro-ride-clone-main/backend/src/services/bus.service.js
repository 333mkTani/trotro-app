const busModel = require('../models/bus.model');
const cache = require('./cache.service');
const { publisher, isReady } = require('../config/redis');
const { ApiError } = require('../utils/ApiError');

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
  const updated = await busModel.updateLocation(id, coords);
  if (!updated) throw ApiError.notFound('Bus not found');

  // Cache last-known location and broadcast to live subscribers.
  await cache.set(LOC_KEY(id), {
    busId: id,
    lat: coords.lat,
    lng: coords.lng,
    at: new Date().toISOString(),
  }, LOCATION_TTL);
  await cache.del(ITEM_KEY(id));

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

  return updated;
};

/** Spatial: live buses near a coordinate via PostGIS. */
const nearby = ({ lat, lng, radiusM, routeId, limit }) =>
  busModel.findNearby({ lat, lng, radiusM, routeId, limit });

const listActive = () => busModel.listActive();

module.exports = { list, getById, create, updateLocation, nearby, listActive };
