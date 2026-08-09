jest.mock('../cache.service', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
}));
jest.mock('../../utils/observability', () => ({
  increment: jest.fn(),
  log: jest.fn(),
}));

const cache = require('../cache.service');
const { env } = require('../../config/env');
const service = require('../routing.service');

const okResponse = (body) => ({ ok: true, status: 200, json: async () => body });

describe('routing.service', () => {
  const realFetch = global.fetch;
  const originalEnv = {
    token: env.MAPBOX_ACCESS_TOKEN,
    baseUrl: env.MAPBOX_DIRECTIONS_BASE_URL,
    traffic: env.MAPBOX_DRIVING_TRAFFIC_ENABLED,
  };

  beforeEach(() => {
    env.MAPBOX_ACCESS_TOKEN = 'pk.test-token';
    env.MAPBOX_DIRECTIONS_BASE_URL = 'https://api.mapbox.test';
    env.MAPBOX_DRIVING_TRAFFIC_ENABLED = false;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  afterAll(() => {
    env.MAPBOX_ACCESS_TOKEN = originalEnv.token;
    env.MAPBOX_DIRECTIONS_BASE_URL = originalEnv.baseUrl;
    env.MAPBOX_DRIVING_TRAFFIC_ENABLED = originalEnv.traffic;
  });

  it('requests longitude-latitude coordinates and normalizes the first route', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse({
      code: 'Ok',
      routes: [{
        distance: 1250,
        duration: 780,
        geometry: { type: 'LineString', coordinates: [[-0.1969, 5.6037], [-0.187, 5.6148]] },
        legs: [{ steps: [{
          distance: 100,
          duration: 60,
          maneuver: {
            instruction: 'Head north',
            type: 'depart',
            modifier: 'straight',
            location: [-0.1969, 5.6037],
          },
        }] }],
      }],
    }));

    const result = await service.getDirections({
      originLat: 5.6037,
      originLng: -0.1969,
      destinationLat: 5.6148,
      destinationLng: -0.187,
      profile: 'walking',
      steps: true,
    });

    const requestedUrl = global.fetch.mock.calls[0][0];
    expect(requestedUrl).toContain('/walking/-0.1969,5.6037;-0.187,5.6148?');
    expect(requestedUrl).toContain('geometries=geojson');
    expect(result).toMatchObject({
      provider: 'mapbox',
      profile: 'walking',
      distanceMeters: 1250,
      durationSeconds: 780,
      steps: [{ instruction: 'Head north', maneuverType: 'depart' }],
    });
    expect(cache.get).toHaveBeenCalledWith(expect.stringContaining('routing:directions:walking:steps'));
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringContaining('routing:directions:walking:steps'),
      result,
      env.MAPBOX_CACHE_TTL_WALKING_SECONDS,
    );
  });

  it('rejects driving-traffic while it is disabled', async () => {
    global.fetch = jest.fn();

    await expect(service.requestDirections({
      originLat: 5.6,
      originLng: -0.2,
      destinationLat: 5.7,
      destinationLng: -0.1,
      profile: 'driving-traffic',
      steps: true,
    })).rejects.toMatchObject({ status: 400 });

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fails safely when the token is missing', async () => {
    env.MAPBOX_ACCESS_TOKEN = '';
    global.fetch = jest.fn();

    await expect(service.requestDirections({ profile: 'driving' }))
      .rejects.toMatchObject({ status: 503, message: 'Routing service is not configured' });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns a controlled not-found error when Mapbox has no route', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse({ code: 'NoRoute', routes: [] }));

    await expect(service.requestDirections({
      originLat: 5.6,
      originLng: -0.2,
      destinationLat: 5.7,
      destinationLng: -0.1,
      profile: 'driving',
      steps: false,
    })).rejects.toMatchObject({ status: 404 });
  });

  it('rejects invalid provider geometry before it can be cached', async () => {
    global.fetch = jest.fn().mockResolvedValue(okResponse({
      code: 'Ok',
      routes: [{
        distance: 100,
        duration: 20,
        geometry: { type: 'LineString', coordinates: [[999, 5.6], [-0.1, 5.7]] },
        legs: [],
      }],
    }));

    await expect(service.getDirections({
      originLat: 5.6,
      originLng: -0.2,
      destinationLat: 5.7,
      destinationLng: -0.1,
      profile: 'driving',
      steps: true,
    })).rejects.toMatchObject({ status: 502 });
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('uses shorter cache lifetimes for traffic-aware routes', () => {
    expect(service.cacheTtlForProfile('walking')).toBe(env.MAPBOX_CACHE_TTL_WALKING_SECONDS);
    expect(service.cacheTtlForProfile('driving')).toBe(env.MAPBOX_CACHE_TTL_DRIVING_SECONDS);
    expect(service.cacheTtlForProfile('driving-traffic')).toBe(env.MAPBOX_CACHE_TTL_TRAFFIC_SECONDS);
  });
});
