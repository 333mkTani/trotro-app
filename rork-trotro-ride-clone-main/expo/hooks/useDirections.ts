import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getDirections } from '@/services/routingApi';
import type { MapCoordinate, RoutingProfile } from '@/types/routing';
import {
  coordinateKey,
  createStraightLineFallback,
  distanceFromRouteMeters,
  isValidCoordinate,
  isValidRouteGeometry,
  shouldUpdateRoutingOrigin,
} from '@/utils/routeGeometry';

type UseDirectionsOptions = {
  origin?: MapCoordinate | null;
  destination?: MapCoordinate | null;
  profile?: RoutingProfile;
  steps?: boolean;
  enabled?: boolean;
  movementThresholdMeters?: number;
  staleTimeMs?: number;
  minimumRerouteIntervalMs?: number;
  maxRouteAgeMs?: number;
  offRouteThresholdMeters?: number;
};

export function useDirections({
  origin,
  destination,
  profile = 'driving',
  steps = true,
  enabled = true,
  movementThresholdMeters = 100,
  staleTimeMs,
  minimumRerouteIntervalMs = 15_000,
  maxRouteAgeMs,
  offRouteThresholdMeters = 60,
}: UseDirectionsOptions) {
  const [routedOrigin, setRoutedOrigin] = useState<MapCoordinate | null>(
    isValidCoordinate(origin) ? origin : null,
  );

  const lastRequestAtRef = useRef(0);

  const canRequest = enabled
    && isValidCoordinate(routedOrigin)
    && isValidCoordinate(destination);

  const query = useQuery({
    queryKey: [
      'directions', profile, steps,
      coordinateKey(routedOrigin), coordinateKey(destination),
    ],
    queryFn: ({ signal }) => {
      lastRequestAtRef.current = Date.now();
      return getDirections({
        origin: routedOrigin!, destination: destination!, profile, steps, signal,
      });
    },
    enabled: canRequest,
    staleTime: staleTimeMs ?? (profile === 'walking' ? 120_000 : 30_000),
    placeholderData: keepPreviousData,
    retry: 1,
    refetchInterval: canRequest ? (maxRouteAgeMs ?? (profile === 'walking' ? 120_000 : 60_000)) : false,
    refetchIntervalInBackground: false,
  });

  const distanceOffRouteMeters = isValidCoordinate(origin)
    ? distanceFromRouteMeters(origin, query.data?.geometry)
    : null;
  const isOffRoute = distanceOffRouteMeters != null
    && distanceOffRouteMeters >= Math.max(0, offRouteThresholdMeters);

  useEffect(() => {
    if (!isValidCoordinate(origin)) {
      setRoutedOrigin(null);
      return undefined;
    }
    const needsNewOrigin = shouldUpdateRoutingOrigin(
      routedOrigin,
      origin,
      movementThresholdMeters,
    ) || isOffRoute;
    if (!needsNewOrigin) return undefined;

    const remainingDelay = Math.max(
      0,
      Math.max(0, minimumRerouteIntervalMs) - (Date.now() - lastRequestAtRef.current),
    );
    const updateOrigin = () => setRoutedOrigin(origin);
    if (remainingDelay === 0) {
      updateOrigin();
      return undefined;
    }
    const timer = setTimeout(updateOrigin, remainingDelay);
    return () => clearTimeout(timer);
  }, [
    origin, routedOrigin, movementThresholdMeters, minimumRerouteIntervalMs, isOffRoute,
  ]);

  const fallbackGeometry = useMemo(
    () => createStraightLineFallback(origin, destination),
    [origin, destination],
  );
  const hasRoadGeometry = canRequest && isValidRouteGeometry(query.data?.geometry);

  return {
    ...query,
    routedOrigin,
    geometry: hasRoadGeometry ? query.data!.geometry : fallbackGeometry,
    isFallback: !hasRoadGeometry && fallbackGeometry !== null,
    canRequest,
    distanceOffRouteMeters,
    isOffRoute,
  };
}
