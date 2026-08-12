import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import createContextHook from '@nkzw/create-context-hook';
import { ApproachingBus, BusStop, Route as RouteType } from '@/types';
import { api } from '@/services/api';

export interface RegionData {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
}

// Region centre-points only — no mock stops
export const ALL_REGIONS: RegionData[] = [
  { id: 'kumasi',     name: 'Kumasi, Ashanti Region',     centerLat: 6.6885, centerLng: -1.6244 },
  { id: 'accra',      name: 'Accra, Greater Accra',        centerLat: 5.5900, centerLng: -0.2050 },
  { id: 'tamale',     name: 'Tamale, Northern Region',     centerLat: 9.4034, centerLng: -0.8424 },
  { id: 'cape-coast', name: 'Cape Coast, Central Region',  centerLat: 5.1036, centerLng: -1.2466 },
  { id: 'takoradi',   name: 'Takoradi, Western Region',    centerLat: 4.8894, centerLng: -1.7554 },
];

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

const mapRoute = (r: Record<string, unknown>): RouteType => {
  const forward = Array.from(new Set(((r.stops_sequence as unknown[]) ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0)));
  const reverseResponse = Array.from(new Set(((r.reverse_stops_sequence as unknown[]) ?? []).filter((id): id is string => typeof id === 'string' && id.length > 0)));
  return {
    id: r.id as string,
    name: r.name as string,
    origin: r.origin as string,
    destination: r.destination as string,
    stops_sequence: forward,
    reverse_stops_sequence: reverseResponse.length === forward.length ? reverseResponse : [...forward].reverse(),
    distance_km: parseFloat(r.distance_km as string),
    duration_min: parseFloat(r.duration_min as string),
    fare: parseFloat(r.fare as string),
    status: (r.status as RouteType['status']) ?? 'active',
  };
};

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
  const [allStops, setAllStops] = useState<BusStop[]>([]);
  const [routes, setRoutes] = useState<RouteType[]>([]);
  const [activeBuses, setActiveBuses] = useState<ApproachingBus[]>([]);
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');

  // Fetch routes filtered by the user's detected city; re-fetches when location resolves
  useEffect(() => {
    api.get('/routes', { params: { city: region.id } })
      .then(({ data }) => setRoutes((data as Record<string, unknown>[]).map(mapRoute)))
      .catch(() => { /* routes stay empty until API responds */ });
  }, [region.id]);

  // Route discovery needs the complete stop catalogue. Nearby stops remain a
  // separate location-scoped collection used only for pickup convenience.
  useEffect(() => {
    api.get('/stops')
      .then(({ data }) => setAllStops(
        (data as Record<string, unknown>[]).filter((s) => !!s.id).map(mapStop),
      ))
      .catch(() => { /* keep the last successful catalogue */ });
  }, []);

  const fetchActiveBuses = useCallback(async () => {
    try {
      const { data } = await api.get('/buses/active', {
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      });
      const seen = new Set<string>();
      const buses = (data as Record<string, unknown>[])
        .map(mapActiveBus)
        .filter((b) => {
          if (!b.driver_id || seen.has(b.driver_id)) return false;
          seen.add(b.driver_id);
          return true;
        });
      setActiveBuses(buses);
    } catch {
      // Keep the last successful list during a temporary network failure.
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      const active = state === 'active';
      setAppActive(active);
      if (active) void fetchActiveBuses();
    });
    return () => subscription.remove();
  }, [fetchActiveBuses]);

  // Availability is operational state, so it must not be cached for the
  // lifetime of the passenger app. Poll and refresh immediately on resume.
  useEffect(() => {
    if (!appActive) return;
    void fetchActiveBuses();
    const interval = setInterval(() => { void fetchActiveBuses(); }, 10_000);
    return () => {
      clearInterval(interval);
    };
  }, [appActive, fetchActiveBuses]);

  // Fetch nearby stops whenever user location changes
  useEffect(() => {
    if (userLat === null || userLng === null) return;
    api.get('/stops/nearby', { params: { lat: userLat, lng: userLng, radius_m: 3000, limit: 50 } })
      .then(({ data }) => setNearbyStops((data as Record<string, unknown>[]).filter((s) => !!s.id).map(mapStop)))
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

  // Use backend nearby stops — no mock fallback
  // Use backend routes when available, otherwise fall back to region mock routes
  const regionRoutes = useMemo(
    () => {
      const activeStopIds = new Set(allStops.filter((stop) => stop.status === 'active').map((stop) => stop.id));
      return routes
        .filter((route) => route.status === 'active')
        .map((route) => {
          const stops_sequence = route.stops_sequence.filter((id) => activeStopIds.has(id));
          return { ...route, stops_sequence, reverse_stops_sequence: [...stops_sequence].reverse() };
        })
        .filter((route) => route.stops_sequence.length >= 2);
    },
    [routes, allStops]
  );

  // Limit the complete catalogue to stops belonging to the detected region's
  // active routes. A 3 km nearby response must never become the route dataset.
  const regionStops = useMemo(() => {
    const routeStopIds = new Set(regionRoutes.flatMap((route) => route.stops_sequence));
    return allStops.filter((stop) => stop.status === 'active' && routeStopIds.has(stop.id));
  }, [allStops, regionRoutes]);

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
    refreshActiveBuses: fetchActiveBuses,
    mapCenter,
    locationLoading,
    locationError,
    allRegions: ALL_REGIONS,
    refreshLocation: fetchLocation,
    switchRegion,
  };
});
