import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Navigation, MapPin, ArrowLeft, LocateFixed, CornerDownRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useDirections } from '@/hooks/useDirections';
import { distanceMeters, getActiveRouteStep } from '@/utils/routeGeometry';

export default function NavigateScreen() {
  const { lat, lng, name } = useLocalSearchParams<{ lat: string; lng: string; name: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const destLat = parseFloat(lat ?? '0');
  const destLng = parseFloat(lng ?? '0');
  const destName = name ?? 'Destination';

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 12,
    }).start();
  }, [slideAnim]);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  const destination = useMemo(
    () => ({ latitude: destLat, longitude: destLng }),
    [destLat, destLng],
  );
  const directions = useDirections({
    origin: userLocation,
    destination,
    profile: 'driving',
    movementThresholdMeters: 100,
  });
  const routeCoords = useMemo(
    () => directions.geometry?.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })) ?? [],
    [directions.geometry],
  );
  const fallbackDistanceMeters = userLocation ? distanceMeters(userLocation, destination) : null;
  const displayedDistanceMeters = directions.data?.distanceMeters ?? fallbackDistanceMeters;
  const distanceText = displayedDistanceMeters == null
    ? ''
    : displayedDistanceMeters < 1000
      ? `${Math.round(displayedDistanceMeters)}m`
      : `${(displayedDistanceMeters / 1000).toFixed(1)}km`;
  const fallbackMinutes = fallbackDistanceMeters == null
    ? null
    : Math.max(1, Math.round((fallbackDistanceMeters / 1000 / 25) * 60));
  const durationMinutes = directions.data?.durationSeconds != null
    ? Math.max(1, Math.ceil(directions.data.durationSeconds / 60))
    : fallbackMinutes;
  const durationText = durationMinutes == null
    ? ''
    : durationMinutes < 60
      ? `${durationMinutes} min`
      : `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`;
  const activeStep = useMemo(
    () => userLocation && directions.data
      ? getActiveRouteStep(directions.data.steps, userLocation, directions.data.geometry)
      : null,
    [userLocation, directions.data],
  );
  const nextInstruction = activeStep?.instruction ?? `Head towards ${destName}`;

  useEffect(() => {
    let mounted = true;
    let webWatchId: number | null = null;
    let nativeSubscription: Location.LocationSubscription | null = null;

    const getLocation = async () => {
      try {
        if (Platform.OS === 'web') {
          if (navigator.geolocation) {
            webWatchId = navigator.geolocation.watchPosition(
              (pos) => {
                if (!mounted) return;
                const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                setUserLocation(loc);
                setLoading(false);
              },
              () => {
                if (!mounted) return;
                const fallback = { latitude: destLat - 0.01, longitude: destLng - 0.008 };
                setUserLocation(fallback);
                setLoading(false);
              },
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 },
            );
          } else {
            const fallback = { latitude: destLat - 0.01, longitude: destLng - 0.008 };
            setUserLocation(fallback);
            setLoading(false);
          }
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('[Navigate] Location permission denied');
          const fallback = { latitude: destLat - 0.01, longitude: destLng - 0.008 };
          setUserLocation(fallback);
          setLoading(false);
          return;
        }

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mounted) return;
        const loc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setUserLocation(loc);
        setLoading(false);
        nativeSubscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            distanceInterval: 25,
            timeInterval: 10000,
          },
          (nextPosition) => {
            if (!mounted) return;
            setUserLocation({
              latitude: nextPosition.coords.latitude,
              longitude: nextPosition.coords.longitude,
            });
          },
        );
      } catch (err) {
        console.log('[Navigate] Error getting location:', err);
        if (!mounted) return;
        const fallback = { latitude: destLat - 0.01, longitude: destLng - 0.008 };
        setUserLocation(fallback);
        setLoading(false);
      }
    };

    getLocation();
    return () => {
      mounted = false;
      if (webWatchId != null && typeof navigator !== 'undefined') {
        navigator.geolocation.clearWatch(webWatchId);
      }
      nativeSubscription?.remove();
    };
  }, [destLat, destLng]);

  const fitToMarkers = useCallback(() => {
    if (!mapRef.current || !userLocation) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mapRef.current.fitToCoordinates(
      routeCoords.length > 1 ? routeCoords : [userLocation, destination],
      { edgePadding: { top: 100, right: 60, bottom: 200, left: 60 }, animated: true }
    );
  }, [userLocation, routeCoords, destination]);

  useEffect(() => {
    if (Platform.OS === 'web' || !mapReady || routeCoords.length < 2) return;
    mapRef.current?.fitToCoordinates(routeCoords, {
      edgePadding: { top: 100, right: 60, bottom: 200, left: 60 },
      animated: true,
    });
  }, [mapReady, routeCoords]);

  const goBack = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, []);

  if (loading) {
    return (
      <View style={s.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={s.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  const region = userLocation
    ? {
        latitude: (userLocation.latitude + destLat) / 2,
        longitude: (userLocation.longitude + destLng) / 2,
        latitudeDelta: Math.abs(userLocation.latitude - destLat) * 1.8 + 0.01,
        longitudeDelta: Math.abs(userLocation.longitude - destLng) * 1.8 + 0.01,
      }
    : {
        latitude: destLat,
        longitude: destLng,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };

  return (
    <View style={s.container}>
      {Platform.OS === 'web' ? (
        <View style={s.webMapFallback}>
          <View style={s.webMapContent}>
            <Navigation size={36} color={Colors.primary} />
            <Text style={s.webMapTitle}>Navigation Active</Text>
            <Text style={s.webMapSub}>{destName}</Text>
            <Text style={s.webMapCoords}>{destLat.toFixed(4)}, {destLng.toFixed(4)}</Text>
          </View>
        </View>
      ) : (
        <MapView
          ref={mapRef}
          style={s.map}
          provider={PROVIDER_DEFAULT}
          initialRegion={region}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          onMapReady={() => setMapReady(true)}
        >
          {userLocation ? (
            <Marker coordinate={userLocation} title="You" anchor={{ x: 0.5, y: 0.5 }}>
              <View style={s.userMarkerOuter}>
                <View style={s.userMarkerInner} />
              </View>
            </Marker>
          ) : null}

          <Marker
            coordinate={{ latitude: destLat, longitude: destLng }}
            title={destName}
          >
            <View style={s.destMarker}>
              <MapPin size={20} color={Colors.white} />
            </View>
          </Marker>

          {routeCoords.length > 1 ? (
            <Polyline
              coordinates={routeCoords}
              strokeColor={Colors.primary}
              strokeWidth={4}
              lineDashPattern={directions.isFallback ? [8, 6] : undefined}
            />
          ) : null}
        </MapView>
      )}

      <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
          onPress={goBack}
          testID="nav-back"
        >
          <ArrowLeft size={22} color={Colors.textPrimary} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [s.recenterBtn, pressed && { opacity: 0.7 }]}
          onPress={fitToMarkers}
          testID="nav-recenter"
        >
          <LocateFixed size={20} color={Colors.primary} />
        </Pressable>
      </View>

      <Animated.View style={[s.bottomSheet, { paddingBottom: insets.bottom + 16, transform: [{ translateY: slideAnim }] }]}>
        <View style={s.sheetHandle} />

        <View style={s.directionHeader}>
          <Animated.View style={[s.navIconCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Navigation size={22} color={Colors.white} />
          </Animated.View>
          <View style={s.directionInfo}>
            <Text style={s.directionTitle}>Navigating to pickup</Text>
            <Text style={s.directionDest} numberOfLines={1}>{destName}</Text>
          </View>
        </View>

        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statValue}>{distanceText || '--'}</Text>
            <Text style={s.statLabel}>Distance</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statValue}>{durationText || '--'}</Text>
            <Text style={s.statLabel}>Est. Time</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <View style={s.liveIndicator}>
              <View style={s.liveDot} />
              <Text style={s.liveText}>Live</Text>
            </View>
            <Text style={s.statLabel}>Tracking</Text>
          </View>
        </View>

        <View style={s.stepRow}>
          <CornerDownRight size={16} color={Colors.primary} />
          <Text style={s.stepText}>{nextInstruction}</Text>
        </View>
        {directions.isError ? (
          <Text style={s.routingWarning}>Road directions unavailable — showing a direct estimate.</Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  webMapFallback: {
    flex: 1,
    backgroundColor: '#E3F2FD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webMapContent: {
    alignItems: 'center',
    gap: 10,
  },
  webMapTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginTop: 8,
  },
  webMapSub: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  webMapCoords: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  loadingText: { fontSize: 15, color: Colors.textSecondary },

  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  recenterBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },

  userMarkerOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(21, 101, 192, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 2.5,
    borderColor: Colors.white,
  },

  destMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },

  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DEE2E6',
    alignSelf: 'center',
    marginBottom: 16,
  },

  directionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  navIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  directionInfo: { flex: 1 },
  directionTitle: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  directionDest: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    marginTop: 2,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  liveText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.success,
  },

  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#EBF4FF',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  stepText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.primary,
    flex: 1,
  },
  routingWarning: {
    marginTop: 8,
    fontSize: 11,
    color: Colors.warning,
    textAlign: 'center',
  },
});
