const stopModel = require('../models/stop.model');
const cache = require('./cache.service');
const { ApiError } = require('../utils/ApiError');

const LIST_KEY = 'stops:list:active';
const ITEM_KEY = (id) => `stops:item:${id}`;
const LIST_TTL = 60;
const ITEM_TTL = 120;

const list = (opts) =>
  cache.wrap(LIST_KEY, LIST_TTL, () => stopModel.list(opts));

const getById = async (id) => {
  const stop = await cache.wrap(ITEM_KEY(id), ITEM_TTL, () => stopModel.findById(id));
  if (!stop) throw ApiError.notFound('Stop not found');
  return stop;
};

const create = async (data) => {
  const stop = await stopModel.insert(data);
  await cache.del(LIST_KEY);
  return stop;
};

const update = async (id, data) => {
  const existing = await stopModel.findById(id);
  if (!existing || existing.status === 'deleted') throw ApiError.notFound('Stop not found');
  const stop = await stopModel.update(id, data);
  await Promise.all([cache.del(LIST_KEY), cache.del(ITEM_KEY(id))]);
  return stop;
};

const archive = async (id) => {
  const stop = await stopModel.findById(id);
  if (!stop || stop.status === 'deleted') throw ApiError.notFound('Stop not found');
  const references = await stopModel.activeReferences(id);
  const total = Object.values(references).reduce((sum, value) => sum + Number(value || 0), 0);
  if (total > 0) {
    throw ApiError.conflict(
      'This stop is still in use. Remove it from non-archived routes, schedules, departure slots and active alerts before deleting it.',
      references,
    );
  }
  const archived = await stopModel.archive(id);
  await Promise.all([cache.del(LIST_KEY), cache.del(ITEM_KEY(id))]);
  return archived;
};

/** Spatial: nearby stops via PostGIS. Cached on (lat, lng, radius) bucket. */
const nearby = async ({ lat, lng, radiusM, limit }) => {
  const key = `stops:near:${lat.toFixed(4)}:${lng.toFixed(4)}:${radiusM}:${limit}`;
  return cache.wrap(key, 30, () => stopModel.findNearby({ lat, lng, radiusM, limit }));
};

module.exports = { list, getById, create, update, archive, nearby };
