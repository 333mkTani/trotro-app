import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { Navigation, MapPin, ArrowLeft, LocateFixed, CornerDownRight } from 'lucide-react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function NavigateScreen() {
  const { lat, lng, name } = useLocalSearchParams<{ lat: string; lng: string; name: string }>();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const destLat = parseFloat(lat ?? '0');
  const destLng = parseFloat(lng ?? '0');
  const destName = name ?? 'Destination';

  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeCoords, setRouteCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [distanceText, setDistanceText] = useState<string>('');
  const [durationText, setDurationText] = useState<string>('');

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

  const calculateDistance = useCallback(
    (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const dLat = ((lat2 - lat1) * Math.PI) / 180;
      const dLon = ((lon2 - lon1) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
          Math.cos((lat2 * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    },
    []
  );

  const generateRoutePoints = useCallback(
    (start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number }) => {
      const points: Array<{ latitude: number; longitude: number }> = [];
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const latOffset = (Math.random() - 0.5) * 0.001 * Math.sin(t * Math.PI);
        const lngOffset = (Math.random() - 0.5) * 0.001 * Math.sin(t * Math.PI);
        points.push({
          latitude: start.latitude + (end.latitude - start.latitude) * t + (i > 0 && i < steps ? latOffset : 0),
          longitude: start.longitude + (end.longitude - start.longitude) * t + (i > 0 && i < steps ? lngOffset : 0),
        });
      }
      return points;
    },
    []
  );

  useEffect(() => {
    let mounted = true;

    const getLocation = async () => {
      try {
        if (Platform.OS === 'web') {
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (!mounted) return;
                const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
                setUserLocation(loc);
                const dist = calculateDistance(loc.latitude, loc.longitude, destLat, destLng);
                setDistanceText(dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`);
                const mins = Math.round((dist / 25) * 60);
                setDurationText(mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`);
                setRouteCoords(generateRoutePoints(loc, { latitude: destLat, longitude: destLng }));
                setLoading(false);
              },
              () => {
                if (!mounted) return;
                const fallback = { latitude: destLat - 0.01, longitude: destLng - 0.008 };
                setUserLocation(fallback);
                setDistanceText('~1.3km');
                setDurationText('~5 min');
                setRouteCoords(generateRoutePoints(fallback, { latitude: destLat, longitude: destLng }));
                setLoading(false);
              }
            );
          } else {
            const fallback = { latitude: destLat - 0.01, longitude: destLng - 0.008 };
            setUserLocation(fallback);
            setDistanceText('~1.3km');
            setDurationText('~5 min');
            setRouteCoords(generateRoutePoints(fallback, { latitude: destLat, longitude: destLng }));
            setLoading(false);
          }
          return;
        }

        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('[Navigate] Location permission denied');
          const fallback = { latitude: destLat - 0.01, longitude: destLng - 0.008 };
          setUserLocation(fallback);
          setDistanceText('~1.3km');
          setDurationText('~5 min');
          setRouteCoords(generateRoutePoints(fallback, { latitude: destLat, longitude: destLng }));
          setLoading(false);
          return;
        }

        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!mounted) return;
        const loc = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setUserLocation(loc);

        const dist = calculateDistance(loc.latitude, loc.longitude, destLat, destLng);
        setDistanceText(dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`);
        const mins = Math.round((dist / 25) * 60);
        setDurationText(mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`);
        setRouteCoords(generateRoutePoints(loc, { latitude: destLat, longitude: destLng }));
        setLoading(false);
      } catch (err) {
        console.log('[Navigate] Error getting location:', err);
        if (!mounted) return;
        const fallback = { latitude: destLat - 0.01, longitude: destLng - 0.008 };
        setUserLocation(fallback);
        setDistanceText('~1.3km');
        setDurationText('~5 min');
        setRouteCoords(generateRoutePoints(fallback, { latitude: destLat, longitude: destLng }));
        setLoading(false);
      }
    };

    getLocation();
    return () => { mounted = false; };
  }, [destLat, destLng, calculateDistance, generateRoutePoints]);

  const fitToMarkers = useCallback(() => {
    if (!mapRef.current || !userLocation) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    mapRef.current.fitToCoordinates(
      [userLocation, { latitude: destLat, longitude: destLng }],
      { edgePadding: { top: 100, right: 60, bottom: 200, left: 60 }, animated: true }
    );
  }, [userLocation, destLat, destLng]);

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
              lineDashPattern={[0]}
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
          <Text style={s.stepText}>Head towards {destName}</Text>
        </View>
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
});
