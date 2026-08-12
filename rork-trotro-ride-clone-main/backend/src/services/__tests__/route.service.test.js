jest.mock('../../models/route.model');
jest.mock('../../models/stop.model');
jest.mock('../cache.service');

const routeModel = require('../../models/route.model');
const stopModel = require('../../models/stop.model');
const cache = require('../cache.service');
const service = require('../route.service');

beforeEach(() => {
  jest.clearAllMocks();
  // Cache disabled for these tests: wrap always runs the loader.
  cache.wrap.mockImplementation((_key, _ttl, loader) => loader());
  cache.del.mockResolvedValue(1);
});

describe('route create', () => {
  it('invalidates the cached listings for the new route city', async () => {
    routeModel.insert.mockResolvedValue({ id: 'r1', city: 'kumasi', fare: '4.00' });
    const created = await service.create({ name: 'A → B', fare: 4 });
    expect(created.id).toBe('r1');
    const keys = cache.del.mock.calls[0];
    // The city-less listing must be dropped too, otherwise GET /routes stays stale.
    expect(keys).toContain('routes:list:active:all');
    expect(keys).toContain('routes:list:active:kumasi');
  });
});

describe('route update', () => {
  it('applies a fare change and clears the item plus list caches', async () => {
    routeModel.findById.mockResolvedValue({ id: 'r1', city: 'accra', status: 'active' });
    routeModel.update.mockResolvedValue({ id: 'r1', city: 'accra', fare: '6.50' });
    const updated = await service.update('r1', { fare: 6.5 });
    expect(routeModel.update).toHaveBeenCalledWith('r1', { fare: 6.5 });
    expect(updated.fare).toBe('6.50');
    expect(cache.del).toHaveBeenCalledWith('routes:item:r1');
  });

  it('rejects an unknown route', async () => {
    routeModel.findById.mockResolvedValue(null);
    await expect(service.update('missing', { fare: 1 })).rejects.toThrow('Route not found');
    expect(routeModel.update).not.toHaveBeenCalled();
  });

  it('refuses to edit an archived route', async () => {
    routeModel.findById.mockResolvedValue({ id: 'r1', city: 'accra', status: 'deleted' });
    await expect(service.update('r1', { fare: 1 })).rejects.toThrow('Deleted routes cannot be edited');
    expect(routeModel.update).not.toHaveBeenCalled();
  });

  it('clears listings for both the old and the new city', async () => {
    routeModel.findById.mockResolvedValue({ id: 'r1', city: 'accra', status: 'active' });
    routeModel.update.mockResolvedValue({ id: 'r1', city: 'kumasi' });
    await service.update('r1', { city: 'kumasi' });
    const keys = cache.del.mock.calls.at(-1);
    expect(keys).toContain('routes:list:active:accra');
    expect(keys).toContain('routes:list:active:kumasi');
  });
});

describe('route stops', () => {
  const ACTIVE_ROUTE = { id: 'r1', city: 'accra', status: 'active' };

  it('replaces the stop list in the order given and clears the caches', async () => {
    routeModel.findById.mockResolvedValue(ACTIVE_ROUTE);
    stopModel.findActiveIds.mockResolvedValue(['s2', 's1']);
    routeModel.replaceStops.mockResolvedValue([
      { sequence: 1, id: 's1' }, { sequence: 2, id: 's2' },
    ]);

    const stops = await service.setStops('r1', ['s1', 's2']);

    expect(routeModel.replaceStops).toHaveBeenCalledWith('r1', ['s1', 's2']);
    expect(stops.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(cache.del).toHaveBeenCalledWith('routes:item:r1');
    // stops_sequence is part of the list payload, so listings must drop too.
    expect(cache.del.mock.calls.at(-1)).toContain('routes:list:active:accra');
  });

  it('clears every stop when given an empty list', async () => {
    routeModel.findById.mockResolvedValue(ACTIVE_ROUTE);
    stopModel.findActiveIds.mockResolvedValue([]);
    routeModel.replaceStops.mockResolvedValue([]);
    await expect(service.setStops('r1', [])).resolves.toEqual([]);
    expect(routeModel.replaceStops).toHaveBeenCalledWith('r1', []);
  });

  it('rejects a stop that does not exist rather than hitting the foreign key', async () => {
    routeModel.findById.mockResolvedValue(ACTIVE_ROUTE);
    stopModel.findActiveIds.mockResolvedValue(['s1']);
    await expect(service.setStops('r1', ['s1', 'ghost']))
      .rejects.toThrow('Unknown or inactive stop: ghost');
    expect(routeModel.replaceStops).not.toHaveBeenCalled();
  });

  it('refuses to edit the stops of an archived route', async () => {
    routeModel.findById.mockResolvedValue({ ...ACTIVE_ROUTE, status: 'deleted' });
    await expect(service.setStops('r1', ['s1']))
      .rejects.toThrow('Deleted routes cannot be edited');
    expect(routeModel.replaceStops).not.toHaveBeenCalled();
  });

  it('rejects an unknown route', async () => {
    routeModel.findById.mockResolvedValue(null);
    await expect(service.setStops('missing', [])).rejects.toThrow('Route not found');
  });

  it('lists the stops attached to a route', async () => {
    routeModel.findById.mockResolvedValue(ACTIVE_ROUTE);
    routeModel.findStops.mockResolvedValue([{ sequence: 1, id: 's1', name: 'Circle' }]);
    await expect(service.listStops('r1')).resolves.toEqual([
      { sequence: 1, id: 's1', name: 'Circle' },
    ]);
  });
});

describe('route archive', () => {
  it('soft deletes and reports what still references the route', async () => {
    routeModel.findById.mockResolvedValue({ id: 'r1', city: 'accra', status: 'active' });
    routeModel.countDependencies.mockResolvedValue({ active_buses: 2, open_bookings: 5 });
    routeModel.archive.mockResolvedValue({ id: 'r1', city: 'accra', status: 'deleted' });
    const result = await service.archive('r1');
    expect(result.status).toBe('deleted');
    expect(result.detached).toEqual({ active_buses: 2, open_bookings: 5 });
  });

  it('rejects an unknown route', async () => {
    routeModel.findById.mockResolvedValue(null);
    await expect(service.archive('missing')).rejects.toThrow('Route not found');
    expect(routeModel.archive).not.toHaveBeenCalled();
  });
});
