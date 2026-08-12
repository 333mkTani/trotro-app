const routeModel = require('../models/route.model');
const stopModel = require('../models/stop.model');
const cache = require('./cache.service');
const { ApiError } = require('../utils/ApiError');

const LIST_KEY = ({ status = 'active', city = null } = {}) =>
  `routes:list:${status}:${city || 'all'}`;
const ITEM_KEY = (id) => `routes:item:${id}`;
const LIST_TTL = 60;
const ITEM_TTL = 120;

const LIST_STATUSES = ['active', 'paused', 'deleted', 'all'];

/**
 * Drops every list key a mutated route could appear in: each status bucket,
 * for the city-less listing plus the cities the route belonged to before and
 * after the change.
 */
const invalidateLists = async (...cities) => {
  const scopes = [null, ...cities.filter(Boolean)];
  const keys = LIST_STATUSES.flatMap((status) =>
    [...new Set(scopes)].map((city) => LIST_KEY({ status, city })));
  await cache.del(...keys);
};

const list = (opts = {}) =>
  cache.wrap(LIST_KEY(opts), LIST_TTL, () => routeModel.list(opts));

const getById = async (id) =>
  cache.wrap(ITEM_KEY(id), ITEM_TTL, async () => {
    const route = await routeModel.findById(id);
    if (!route) throw ApiError.notFound('Route not found');
    const stops = await routeModel.findStops(id);
    return { ...route, stops };
  });

const create = async (data) => {
  const route = await routeModel.insert(data);
  await invalidateLists(route.city);
  return route;
};

const update = async (id, data) => {
  const existing = await routeModel.findById(id);
  if (!existing) throw ApiError.notFound('Route not found');
  if (existing.status === 'deleted') {
    throw ApiError.badRequest('Deleted routes cannot be edited');
  }
  const route = await routeModel.update(id, data);
  await cache.del(ITEM_KEY(id));
  await invalidateLists(existing.city, route.city);
  return route;
};

const listStops = async (id) => (await getById(id)).stops;

/**
 * Replace a route's stops with the ordered list `stopIds`.
 *
 * The whole list is sent rather than add/remove/move verbs: sequence numbers
 * stay unambiguous, concurrent edits can't interleave into a half-applied
 * order, and re-sending the same array is a no-op.
 */
const setStops = async (id, stopIds) => {
  const route = await routeModel.findById(id);
  if (!route) throw ApiError.notFound('Route not found');
  if (route.status === 'deleted') {
    throw ApiError.badRequest('Deleted routes cannot be edited');
  }
  const known = new Set(await stopModel.findActiveIds(stopIds));
  const unknown = stopIds.filter((stopId) => !known.has(stopId));
  if (unknown.length > 0) {
    throw ApiError.badRequest(`Unknown or inactive stop: ${unknown.join(', ')}`);
  }
  const stops = await routeModel.replaceStops(id, stopIds);
  await cache.del(ITEM_KEY(id));
  // stops_sequence rides along in the list payload, so the listings go stale too.
  await invalidateLists(route.city);
  return stops;
};

/** Soft delete — see routeModel.archive. Reports what was still attached. */
const archive = async (id) => {
  const existing = await routeModel.findById(id);
  if (!existing) throw ApiError.notFound('Route not found');
  const dependencies = await routeModel.countDependencies(id);
  const route = await routeModel.archive(id);
  await cache.del(ITEM_KEY(id));
  await invalidateLists(existing.city);
  return { ...route, detached: dependencies };
};

module.exports = { list, getById, create, update, archive, listStops, setStops };
