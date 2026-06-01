import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import createContextHook from '@nkzw/create-context-hook';
import { ApproachingBus, BusStop, Route as RouteType } from '@/types';
import { ALL_REGIONS, RegionData } from '@/mocks/stops';
import { api } from '@/services/api';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function detectRegion(lat: number, lng: number): RegionData {
  let closest = ALL_REGIONS[0];
  let minDist = Infinity;
  for (const region of ALL_REGIONS) {
    const dist = haversineDistance(lat, lng, region.centerLat, region.centerLng);
    if (dist < minDist) { minDist = dist; closest = region; }
  }
  return closest;
}

const mapStop = (s: Record<string, unknown>): BusStop => ({
  id: s.id as string,
  name: s.name as string,
  type: (s.type as BusStop['type']) ?? 'stop',
  lat: parseFloat(s.lat as string),
  lng: parseFloat(s.lng as string),
  status: (s.status as BusStop['status']) ?? 'active',
  distance_m: s.distance_m as number | undefined,
});

const mapRoute = (r: Record<string, unknown>): RouteType => ({
  id: r.id as string,
  name: r.name as string,
  origin: r.origin as string,
  destination: r.destination as string,
  stops_sequence: (r.stops_sequence as string[]) ?? [],
  distance_km: parseFloat(r.distance_km as string),
  duration_min: parseFloat(r.duration_min as string),
  fare: parseFloat(r.fare as string),
  status: (r.status as RouteType['status']) ?? 'active',
});

const mapActiveBus = (b: Record<string, unknown>): ApproachingBus => ({
  driver_id: b.driver_id as string,
  bus_registration: b.bus_registration as string,
  driver_name: (b.driver_name as string) ?? 'Driver',
  seats_available: (b.seats_available as number) ?? 0,
  eta_minutes: 5,
  route_name: (b.route_name as string) ?? '',
  lat: b.current_lat ? parseFloat(b.current_lat as string) : 0,
  lng: b.current_lng ? parseFloat(b.current_lng as string) : 0,
});

export const [LocationProvider, useLocation] = createContextHook(() => {
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [region, setRegion] = useState<RegionData>(ALL_REGIONS[0]);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [nearbyStops, setNearbyStops] = useState<BusStop[]>([]);
  const [routes, setRoutes] = useState<RouteType[]>([]);
  const [activeBuses, setActiveBuses] = useState<ApproachingBus[]>([]);

  // Fetch routes filtered by the user's detected city; re-fetches when location resolves
  useEffect(() => {
    api.get('/routes', { params: { city: region.id } })
      .then(({ data }) => setRoutes((data as Record<string, unknown>[]).map(mapRoute)))
      .catch(() => { /* use mock fallback via regionRoutes */ });
  }, [region.id]);

  // Fetch active buses once on mount
  useEffect(() => {
    api.get('/buses/active')
      .then(({ data }) => setActiveBuses((data as Record<string, unknown>[]).map(mapActiveBus)))
      .catch(() => {});
  }, []);

  // Fetch nearby stops whenever user location changes
  useEffect(() => {
    if (userLat === null || userLng === null) return;
    api.get('/stops/nearby', { params: { lat: userLat, lng: userLng, radius_m: 3000, limit: 50 } })
      .then(({ data }) => setNearbyStops((data as Record<string, unknown>[]).map(mapStop)))
      .catch(() => { /* keep previous stops */ });
  }, [userLat, userLng]);

  const fetchLocation = useCallback(async () => {
    setLocationLoading(true);
    setLocationError(null);

    try {
      if (Platform.OS === 'web') {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            ({ coords: { latitude, longitude } }) => {
              setUserLat(latitude);
              setUserLng(longitude);
              setRegion(detectRegion(latitude, longitude));
              setLocationLoading(false);
            },
            () => { setRegion(ALL_REGIONS[0]); setLocationLoading(false); },
            { timeout: 8000, enableHighAccuracy: false }
          );
        } else {
          setRegion(ALL_REGIONS[0]);
          setLocationLoading(false);
        }
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('Location permission denied');
        setRegion(ALL_REGIONS[0]);
        setLocationLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      setUserLat(latitude);
      setUserLng(longitude);
      setRegion(detectRegion(latitude, longitude));
      setLocationLoading(false);
    } catch {
      setLocationError('Could not get location');
      setRegion(ALL_REGIONS[0]);
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => { fetchLocation(); }, [fetchLocation]);

  // Use backend nearby stops when available, otherwise fall back to region mock stops
  const regionStops = useMemo(
    () => nearbyStops.length > 0
      ? nearbyStops.filter((s) => s.status === 'active')
      : region.stops.filter((s) => s.status === 'active'),
    [nearbyStops, region]
  );

  // Use backend routes when available, otherwise fall back to region mock routes
  const regionRoutes = useMemo(
    () => routes.length > 0 ? routes.filter((r) => r.status === 'active') : [],
    [routes]
  );

  const mapCenter = useMemo(
    () => ({
      latitude: userLat ?? region.centerLat,
      longitude: userLng ?? region.centerLng,
      latitudeDelta: 0.12,
      longitudeDelta: 0.12,
    }),
    [userLat, userLng, region]
  );

  const switchRegion = useCallback((regionId: string) => {
    const found = ALL_REGIONS.find((r) => r.id === regionId);
    if (found) setRegion(found);
  }, []);

  return {
    userLat,
    userLng,
    regionId: region.id,
    regionName: region.name,
    regionStops,
    nearbyStops,
    regionRoutes,
    activeBuses,
    mapCenter,
    locationLoading,
    locationError,
    allRegions: ALL_REGIONS,
    refreshLocation: fetchLocation,
    switchRegion,
  };
});
