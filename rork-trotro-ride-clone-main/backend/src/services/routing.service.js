const cache = require('./cache.service');
const { env } = require('../config/env');
const { ApiError } = require('../utils/ApiError');
const { routeCacheKey } = require('../utils/routeCacheKey');

const publicProfiles = new Set(['walking', 'driving', 'driving-traffic']);

const providerError = (status) => {
  if (status === 401 || status === 403) {
    return new ApiError(503, 'Routing service is not configured correctly');
  }
  if (status === 429) return ApiError.tooMany('Routing service is temporarily busy');
  return new ApiError(502, 'Routing provider request failed');
};

const normalizeStep = (step) => ({
  instruction: step.maneuver?.instruction || 'Continue toward your destination',
  distanceMeters: step.distance,
  durationSeconds: step.duration,
  maneuverType: step.maneuver?.type || null,
  modifier: step.maneuver?.modifier || null,
  location: step.maneuver?.location || null,
});

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

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw providerError(response.status);

    const body = await response.json();
    const route = body.routes?.[0];
    if (body.code !== 'Ok' || !route?.geometry?.coordinates?.length) {
      throw ApiError.notFound('No road route was found');
    }

    return {
      provider: 'mapbox',
      profile: input.profile,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry,
      steps: input.steps
        ? (route.legs || []).flatMap((leg) => (leg.steps || []).map(normalizeStep))
        : [],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError(504, 'Routing provider timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

const getDirections = async (input) =>
  cache.wrap(
    routeCacheKey(input),
    env.ROUTING_CACHE_TTL_SECONDS,
    () => requestDirections(input),
  );

module.exports = { getDirections, requestDirections };
