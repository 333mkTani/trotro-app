import type { MapCoordinate, RouteDirections } from '@/types/routing';

const EARTH_RADIUS_METERS = 6_371_000;

export type RouteBounds = {
  northEast: MapCoordinate;
  southWest: MapCoordinate;
};

export function isValidCoordinate(value?: MapCoordinate | null): value is MapCoordinate {
  return Boolean(
    value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude)
    && value.latitude >= -90 && value.latitude <= 90
    && value.longitude >= -180 && value.longitude <= 180,
  );
}

export function distanceMeters(a: MapCoordinate, b: MapCoordinate): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latDelta = radians(b.latitude - a.latitude);
  const lngDelta = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(latDelta / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

export function shouldUpdateRoutingOrigin(
  routedOrigin: MapCoordinate | null,
  currentOrigin: MapCoordinate,
  thresholdMeters: number,
): boolean {
  return !routedOrigin || distanceMeters(routedOrigin, currentOrigin) >= Math.max(0, thresholdMeters);
}

export function coordinateKey(coordinate?: MapCoordinate | null): string {
  return isValidCoordinate(coordinate)
    ? `${coordinate.latitude.toFixed(4)},${coordinate.longitude.toFixed(4)}`
    : 'invalid';
}

export function createStraightLineFallback(
  origin?: MapCoordinate | null,
  destination?: MapCoordinate | null,
): RouteDirections['geometry'] | null {
  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) return null;
  return {
    type: 'LineString',
    coordinates: [
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude],
    ],
  };
}

export function isValidRouteGeometry(
  geometry?: RouteDirections['geometry'] | null,
): geometry is RouteDirections['geometry'] {
  return Boolean(
    geometry && geometry.type === 'LineString' && geometry.coordinates.length >= 2
    && geometry.coordinates.every(([lng, lat]) =>
      Number.isFinite(lat) && Number.isFinite(lng)
      && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180),
  );
}

export function getRouteBounds(
  geometry?: RouteDirections['geometry'] | null,
): RouteBounds | null {
  if (!isValidRouteGeometry(geometry)) return null;
  const lngs = geometry.coordinates.map(([lng]) => lng);
  const lats = geometry.coordinates.map(([, lat]) => lat);
  return {
    northEast: { latitude: Math.max(...lats), longitude: Math.max(...lngs) },
    southWest: { latitude: Math.min(...lats), longitude: Math.min(...lngs) },
  };
}

function distanceToSegmentMeters(
  point: MapCoordinate,
  start: MapCoordinate,
  end: MapCoordinate,
): number {
  const latitudeScale = 111_320;
  const longitudeScale = latitudeScale * Math.cos(point.latitude * Math.PI / 180);
  const startX = (start.longitude - point.longitude) * longitudeScale;
  const startY = (start.latitude - point.latitude) * latitudeScale;
  const endX = (end.longitude - point.longitude) * longitudeScale;
  const endY = (end.latitude - point.latitude) * latitudeScale;
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(startX, startY);
  const projection = Math.max(0, Math.min(1, -(startX * dx + startY * dy) / lengthSquared));
  return Math.hypot(startX + projection * dx, startY + projection * dy);
}

export function distanceFromRouteMeters(
  point: MapCoordinate,
  geometry?: RouteDirections['geometry'] | null,
): number | null {
  if (!isValidCoordinate(point) || !isValidRouteGeometry(geometry)) return null;
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 1; index < geometry.coordinates.length; index += 1) {
    const [startLng, startLat] = geometry.coordinates[index - 1];
    const [endLng, endLat] = geometry.coordinates[index];
    minimum = Math.min(minimum, distanceToSegmentMeters(
      point,
      { latitude: startLat, longitude: startLng },
      { latitude: endLat, longitude: endLng },
    ));
  }
  return Number.isFinite(minimum) ? minimum : null;
}
