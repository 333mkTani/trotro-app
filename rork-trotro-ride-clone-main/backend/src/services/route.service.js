const routeModel = require('../models/route.model');
const cache = require('./cache.service');
const { ApiError } = require('../utils/ApiError');

const LIST_KEY = 'routes:list:active';
const ITEM_KEY = (id) => `routes:item:${id}`;
const LIST_TTL = 60;
const ITEM_TTL = 120;

const list = (opts) =>
  cache.wrap(LIST_KEY, LIST_TTL, () => routeModel.list(opts));

const getById = async (id) =>
  cache.wrap(ITEM_KEY(id), ITEM_TTL, async () => {
    const route = await routeModel.findById(id);
    if (!route) throw ApiError.notFound('Route not found');
    const stops = await routeModel.findStops(id);
    return { ...route, stops };
  });

const create = async (data) => {
  const route = await routeModel.insert(data);
  await cache.del(LIST_KEY);
  return route;
};

module.exports = { list, getById, create };
