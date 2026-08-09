const cache = require('./cache.service');
const { env } = require('../config/env');
const { ApiError } = require('../utils/ApiError');
const { routeCacheKey } = require('../utils/routeCacheKey');
const observability = require('../utils/observability');

const publicProfiles = new Set(['walking', 'driving', 'driving-traffic']);
const MAX_ROUTE_COORDINATES = 50_000;
const MAX_PROVIDER_BYTES = 5 * 1024 * 1024;

const providerError = (status) => {
  if (status === 401 || status === 403) {
    return new ApiError(503, 'Routing service is not configured correctly');
  }
  if (status === 429) return ApiError.tooMany('Routing service is temporarily busy');
  return new ApiError(502, 'Routing provider request failed');
};

const finiteNonNegative = (value) => Number.isFinite(value) && value >= 0;
const validPosition = (position) => Array.isArray(position)
  && position.length >= 2
  && Number.isFinite(position[0]) && position[0] >= -180 && position[0] <= 180
  && Number.isFinite(position[1]) && position[1] >= -90 && position[1] <= 90;

const normalizeStep = (step) => ({
  instruction: typeof step?.maneuver?.instruction === 'string'
    ? step.maneuver.instruction.slice(0, 500)
    : 'Continue toward your destination',
  distanceMeters: finiteNonNegative(step?.distance) ? step.distance : 0,
  durationSeconds: finiteNonNegative(step?.duration) ? step.duration : 0,
  maneuverType: step.maneuver?.type || null,
  modifier: step.maneuver?.modifier || null,
  location: validPosition(step.maneuver?.location)
    ? [step.maneuver.location[0], step.maneuver.location[1]]
    : null,
});

const normalizeProviderRoute = (route, profile, includeSteps) => {
  if (!route || !finiteNonNegative(route.distance) || !finiteNonNegative(route.duration)) {
    throw new ApiError(502, 'Routing provider returned an invalid route');
  }
  const coordinates = route.geometry?.coordinates;
  if (
    route.geometry?.type !== 'LineString'
    || !Array.isArray(coordinates)
    || coordinates.length < 2
    || coordinates.length > MAX_ROUTE_COORDINATES
    || !coordinates.every(validPosition)
  ) {
    throw new ApiError(502, 'Routing provider returned invalid geometry');
  }

  return {
    provider: 'mapbox',
    profile,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    geometry: {
      type: 'LineString',
      coordinates: coordinates.map((position) => [position[0], position[1]]),
    },
    steps: includeSteps
      ? (route.legs || []).flatMap((leg) => (leg.steps || []).map(normalizeStep))
      : [],
    generatedAt: new Date().toISOString(),
  };
};

const cacheTtlForProfile = (profile) => {
  if (profile === 'walking') return env.MAPBOX_CACHE_TTL_WALKING_SECONDS;
  if (profile === 'driving-traffic') return env.MAPBOX_CACHE_TTL_TRAFFIC_SECONDS;
  return env.MAPBOX_CACHE_TTL_DRIVING_SECONDS;
};

const requestDirections = async (input) => {
  if (!env.MAPBOX_ACCESS_TOKEN) {
    throw new ApiError(503, 'Routing service is not configured');
  }
  if (!publicProfiles.has(input.profile)) {
    throw ApiError.badRequest('Unsupported routing profile');
  }
  if (input.profile === 'driving-traffic' && !env.MAPBOX_DRIVING_TRAFFIC_ENABLED) {
    throw ApiError.badRequest('The driving-traffic profile is not enabled');
  }

  const coordinates = [
    `${input.originLng},${input.originLat}`,
    `${input.destinationLng},${input.destinationLat}`,
  ].join(';');
  const params = new URLSearchParams({
    access_token: env.MAPBOX_ACCESS_TOKEN,
    geometries: 'geojson',
    overview: 'full',
    steps: String(input.steps),
    alternatives: 'false',
    language: 'en',
  });
  const url = `${env.MAPBOX_DIRECTIONS_BASE_URL}/directions/v5/mapbox/${input.profile}/${coordinates}?${params}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), env.ROUTING_REQUEST_TIMEOUT_MS);
  const startedAt = Date.now();
  observability.increment('routing.provider.requests', 1, { profile: input.profile });

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw providerError(response.status);

    const contentLength = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_PROVIDER_BYTES) {
      throw new ApiError(502, 'Routing provider response was too large');
    }

    const body = await response.json();
    const route = body.routes?.[0];
    if (body.code === 'NoRoute' || (body.code === 'Ok' && !route)) {
      throw ApiError.notFound('No road route was found');
    }
    if (body.code !== 'Ok') throw new ApiError(502, 'Routing provider returned an invalid response');

    const normalized = normalizeProviderRoute(route, input.profile, input.steps);
    observability.increment('routing.provider.success', 1, { profile: input.profile });
    observability.log('info', 'routing.provider.success', {
      provider: 'mapbox',
      profile: input.profile,
      durationMs: Date.now() - startedAt,
      coordinateCount: normalized.geometry.coordinates.length,
    });
    return normalized;
  } catch (error) {
    let safeError = error;
    if (error?.name === 'AbortError') {
      safeError = new ApiError(504, 'Routing provider timed out');
    } else if (!(error instanceof ApiError)) {
      safeError = new ApiError(502, 'Routing provider request failed');
    }
    observability.increment('routing.provider.failure', 1, {
      profile: input.profile,
      status: safeError.status || 500,
    });
    observability.log('error', 'routing.provider.failure', {
      provider: 'mapbox',
      profile: input.profile,
      durationMs: Date.now() - startedAt,
      status: safeError.status || 500,
    });
    throw safeError;
  } finally {
    clearTimeout(timeout);
  }
};

const getDirections = async (input) => {
  const key = routeCacheKey(input);
  const cached = await cache.get(key);
  if (cached != null) {
    observability.increment('routing.cache.hit', 1, { profile: input.profile });
    return cached;
  }
  observability.increment('routing.cache.miss', 1, { profile: input.profile });
  const result = await requestDirections(input);
  await cache.set(key, result, cacheTtlForProfile(input.profile));
  return result;
};

module.exports = {
  getDirections,
  requestDirections,
  normalizeProviderRoute,
  cacheTtlForProfile,
};
