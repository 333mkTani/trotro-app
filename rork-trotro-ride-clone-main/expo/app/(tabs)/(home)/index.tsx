import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
  PanResponder,
} from "react-native";
import { useRouter } from "expo-router";
import { AlertCircle, MapPin, Search, Bell, BellRing, ChevronUp, Locate, Bus, Clock } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapLibreGL from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useBusAlerts } from "@/contexts/BusAlertContext";
import { useLocation } from "@/contexts/LocationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBookings } from "@/contexts/BookingContext";
import OfflineBanner from "@/components/OfflineBanner";
import ActiveRideCard from "@/components/ActiveRideCard";
import { api } from "@/services/api";
import {
  connectSocket,
  getSocket,
  subscribeToBus,
  unsubscribeFromBus,
  type BusLocationEvent,
} from "@/services/socket";
import { useDirections } from "@/hooks/useDirections";
import { getRouteBounds } from "@/utils/routeGeometry";
import type { BusStop as BusStopData } from "@/types";
const Colors = StaticColors;

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");



export default function HomeScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  s = React.useMemo(() => make_s(themeColors), [themeColors]);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeAlerts, triggeredAlerts } = useBusAlerts();
  const { activeBuses, regionStops, mapCenter, refreshLocation } = useLocation();
  const { user } = useAuth();
  const { bookings, bookingsError, refreshBookings } = useBookings();
  const [refreshing, setRefreshing] = useState(false);
  const [offline] = useState(false);
  const cameraRef = useRef<React.ComponentRef<typeof MapLibreGL.Camera>>(null);
  const scrollRef = useRef<ScrollView>(null);

  const topInset = insets.top || 0;
  const bottomInset = insets.bottom || 0;
  const tabBarHeight = Platform.OS === "web" ? 60 : 56 + bottomInset;

  const topOverlayHeight = topInset + 8 + 40 + 10 + 46 + 10;
  const SNAP_TOP = topOverlayHeight + 4;
  const SNAP_MID = SCREEN_HEIGHT * 0.52;
  const SNAP_BOTTOM = SCREEN_HEIGHT - tabBarHeight - 90;

  const translateY = useRef(new Animated.Value(SNAP_MID)).current;
  const lastSnap = useRef(SNAP_MID);
  const isScrollEnabled = useRef(false);
  const [scrollEnabled, setScrollEnabled] = useState(false);

  const snapTo = useCallback(
    (toValue: number, velocity?: number) => {
      lastSnap.current = toValue;
      const atTop = toValue <= SNAP_TOP + 10;
      isScrollEnabled.current = atTop;
      setScrollEnabled(atTop);

      Animated.spring(translateY, {
        toValue,
        useNativeDriver: true,
        tension: 65,
        friction: 12,
        velocity: velocity ?? 0,
      }).start();
    },
    [translateY, SNAP_TOP]
  );

  const findClosestSnap = useCallback(
    (currentY: number, vy: number) => {
      const snaps = [SNAP_TOP, SNAP_MID, SNAP_BOTTOM];
      const velocityThreshold = 0.6;

      if (Math.abs(vy) > velocityThreshold) {
        if (vy < 0) {
          const above = snaps.filter((s) => s < lastSnap.current);
          if (above.length > 0) return above[above.length - 1];
        } else {
          const below = snaps.filter((s) => s > lastSnap.current);
          if (below.length > 0) return below[0];
        }
      }
      return snaps.reduce((prev, curr) =>
        Math.abs(curr - currentY) < Math.abs(prev - currentY) ? curr : prev
      );
    },
    [SNAP_TOP, SNAP_MID, SNAP_BOTTOM]
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => {
        if (isScrollEnabled.current && gs.dy < 0) return false;
        return Math.abs(gs.dy) > 10 && Math.abs(gs.dy) > Math.abs(gs.dx) * 1.2;
      },
      onPanResponderGrant: () => {
        translateY.stopAnimation();
      },
      onPanResponderMove: (_, gs) => {
        const newY = Math.max(SNAP_TOP, Math.min(SNAP_BOTTOM, lastSnap.current + gs.dy));
        translateY.setValue(newY);
      },
      onPanResponderRelease: (_, gs) => {
        const currentPos = Math.max(
          SNAP_TOP,
          Math.min(SNAP_BOTTOM, lastSnap.current + gs.dy)
        );
        const target = findClosestSnap(currentPos, gs.vy);
        snapTo(target, gs.vy);
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    })
  ).current;

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await Promise.all([refreshLocation(), refreshBookings()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshLocation, refreshBookings]);

  const onMapPress = useCallback(() => {
    if (lastSnap.current < SNAP_MID) {
      snapTo(SNAP_MID);
    }
  }, [snapTo, SNAP_MID]);

  const recenterMap = useCallback(async () => {
    try {
      if (Platform.OS === "web") {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log("[Home] Web geolocation:", position.coords);
            },
            (err) => {
              console.log("[Home] Web geolocation error:", err.message);
            }
          );
        }
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("[Home] Location permission denied, recentering to default");
        cameraRef.current?.setCamera({
          centerCoordinate: [mapCenter.longitude, mapCenter.latitude],
          zoomLevel: 12,
          animationDuration: 500,
        });
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      console.log("[Home] Current location:", location.coords.latitude, location.coords.longitude);

      cameraRef.current?.setCamera({
        centerCoordinate: [location.coords.longitude, location.coords.latitude],
        zoomLevel: 17,
        animationDuration: 500,
      });
    } catch (err) {
      console.log("[Home] Location error, falling back to default:", err);
      cameraRef.current?.setCamera({
        centerCoordinate: [mapCenter.longitude, mapCenter.latitude],
        zoomLevel: 12,
        animationDuration: 500,
      });
    }
  }, [mapCenter]);

  const mapInputMin = Math.min(SNAP_TOP, SNAP_MID);
  const mapInputMax = Math.max(SNAP_TOP, SNAP_MID);
  const mapOpacity = translateY.interpolate({
    inputRange: [mapInputMin, mapInputMax],
    outputRange: SNAP_TOP <= SNAP_MID ? [0.4, 1] : [1, 0.4],
    extrapolate: "clamp",
  });

  const recentDestinations = useMemo(() => {
    const mine = bookings
      .filter((b) => b.passenger_id === user?.id || b.passenger_id === "pass-1")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const seen = new Set<string>();
    const unique: typeof mine = [];
    for (const b of mine) {
      if (seen.has(b.destination_stop_name)) continue;
      seen.add(b.destination_stop_name);
      unique.push(b);
    }
    return unique.slice(0, 8);
  }, [bookings, user?.id]);

  const stopById = useMemo(
    () => new Map(regionStops.map((stop) => [stop.id, stop])),
    [regionStops]
  );

  const activeBooking = useMemo(
    () => bookings
      .filter((booking) => booking.status === "confirmed" && (booking.passenger_id === user?.id || booking.passenger_id === "pass-1"))
      .sort((a, b) => new Date(b.confirmed_at ?? b.created_at).getTime() - new Date(a.confirmed_at ?? a.created_at).getTime())[0],
    [bookings, user?.id]
  );
  const activeBookingBus = useMemo(
    () => activeBuses.find((bus) => bus.driver_id === activeBooking?.driver_id),
    [activeBuses, activeBooking?.driver_id]
  );
  const activeTargetStopId = activeBooking
    ? (activeBooking.boarded_at ? activeBooking.destination_stop_id : activeBooking.pickup_stop_id)
    : undefined;
  const [fetchedTargetStop, setFetchedTargetStop] = useState<BusStopData | null>(null);

  useEffect(() => {
    const catalogueStop = activeTargetStopId ? stopById.get(activeTargetStopId) : undefined;
    if (!activeTargetStopId || catalogueStop) {
      setFetchedTargetStop(null);
      return;
    }

    let disposed = false;
    setFetchedTargetStop(null);
    void api.get(`/stops/${activeTargetStopId}`)
      .then(({ data }) => {
        if (disposed) return;
        const lat = Number(data?.lat);
        const lng = Number(data?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setFetchedTargetStop({
          id: String(data.id),
          name: String(data.name),
          type: data.type ?? "stop",
          lat,
          lng,
          status: data.status ?? "active",
        });
      })
      .catch(() => {
        // The active ride card will remain in its explicit unavailable state.
      });

    return () => {
      disposed = true;
    };
  }, [activeTargetStopId, stopById]);

  const activeTargetStop = useMemo(
    () => activeTargetStopId
      ? stopById.get(activeTargetStopId) ??
        (fetchedTargetStop?.id === activeTargetStopId ? fetchedTargetStop : undefined)
      : undefined,
    [activeTargetStopId, fetchedTargetStop, stopById]
  );
  const isPassengerOnBoard = Boolean(activeBooking?.boarded_at);
  const [assignedBusPosition, setAssignedBusPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!isPassengerOnBoard || !activeBooking?.driver_id) {
      setAssignedBusPosition(null);
      return;
    }

    let disposed = false;
    let busId: string | null = null;
    const driverId = activeBooking.driver_id;
    const applyPosition = (lat: number, lng: number) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180 || (lat === 0 && lng === 0)) return;
      setAssignedBusPosition({ lat, lng });
    };
    const onLocation = (event: BusLocationEvent) => {
      if (event.busId === busId) applyPosition(event.lat, event.lng);
    };
    const onConnect = () => {
      if (busId) subscribeToBus(busId);
    };

    const setup = async () => {
      try {
        const { data } = await api.get(`/buses/driver/${driverId}/location`);
        if (disposed) return;
        busId = data?.bus_id ?? null;
        applyPosition(Number(data?.lat), Number(data?.lng));
        if (!busId) return;
        const socket = await connectSocket();
        if (disposed) return;
        subscribeToBus(busId);
        socket.on("bus:location", onLocation);
        socket.on("connect", onConnect);
      } catch {
        // The existing active-bus polling remains available as a fallback.
      }
    };
    void setup();

    return () => {
      disposed = true;
      const socket = getSocket();
      socket?.off("bus:location", onLocation);
      socket?.off("connect", onConnect);
      if (busId) unsubscribeFromBus(busId);
    };
  }, [activeBooking?.driver_id, isPassengerOnBoard]);

  const assignedBusForMap = useMemo(() => {
    if (!activeBooking?.driver_id) return undefined;

    // An assigned bus must remain trackable even when it is no longer in the
    // public discovery feed (for example, after its last seat is reserved).
    // The booking and driver-location endpoint are the authoritative sources
    // for an active passenger journey; /buses/active is only optional display
    // metadata here.
    if (assignedBusPosition) {
      return {
        driver_id: activeBooking.driver_id,
        bus_registration:
          activeBooking.bus_registration ?? activeBookingBus?.bus_registration ?? "Assigned bus",
        driver_name:
          activeBooking.driver_name ?? activeBookingBus?.driver_name ?? "Driver",
        seats_available: activeBookingBus?.seats_available ?? 0,
        eta_minutes: activeBookingBus?.eta_minutes ?? 0,
        route_name: activeBooking.route_name ?? activeBookingBus?.route_name ?? "",
        lat: assignedBusPosition.lat,
        lng: assignedBusPosition.lng,
      };
    }

    return activeBookingBus;
  }, [activeBooking, activeBookingBus, assignedBusPosition]);

  const busesForMap = useMemo(
    () => isPassengerOnBoard
      ? (assignedBusForMap ? [assignedBusForMap] : [])
      : activeBuses.filter((bus) => bus.seats_available > 0),
    [activeBuses, assignedBusForMap, isPassengerOnBoard]
  );

  const onboardDirections = useDirections({
    origin: assignedBusForMap && assignedBusForMap.lat !== 0 && assignedBusForMap.lng !== 0
      ? { latitude: assignedBusForMap.lat, longitude: assignedBusForMap.lng }
      : null,
    destination: activeTargetStop
      ? { latitude: activeTargetStop.lat, longitude: activeTargetStop.lng }
      : null,
    profile: "driving",
    movementThresholdMeters: 50,
    staleTimeMs: 30_000,
    maxRouteAgeMs: 60_000,
    offRouteThresholdMeters: 60,
    enabled: isPassengerOnBoard,
  });
  const onboardRouteBounds = useMemo(
    () => getRouteBounds(onboardDirections.geometry),
    [onboardDirections.geometry]
  );

  useEffect(() => {
    if (!isPassengerOnBoard || !assignedBusForMap || assignedBusForMap.lat === 0 || assignedBusForMap.lng === 0) return;
    if (onboardRouteBounds) {
      cameraRef.current?.fitBounds(
        [onboardRouteBounds.northEast.longitude, onboardRouteBounds.northEast.latitude],
        [onboardRouteBounds.southWest.longitude, onboardRouteBounds.southWest.latitude],
        [110, 45, 260, 45],
        700
      );
      return;
    }
    cameraRef.current?.setCamera({
      centerCoordinate: [assignedBusForMap.lng, assignedBusForMap.lat],
      zoomLevel: 16,
      animationDuration: 700,
    });
  }, [assignedBusForMap, isPassengerOnBoard, onboardRouteBounds]);

  const onSelectRecentDestination = useCallback(
    (b: (typeof recentDestinations)[number]) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const stop = stopById.get(b.destination_stop_id);
      if (stop) {
        router.push({
          pathname: "/find-route",
          params: {
            pinLat: String(stop.lat),
            pinLng: String(stop.lng),
            pinLabel: stop.name,
          },
        });
      } else {
        router.push("/find-route");
      }
    },
    [router, stopById]
  );

  return (
    <View style={s.root}>
      <Animated.View style={[s.mapContainer, { opacity: mapOpacity }]}>
        {Platform.OS === "web" ? (
          <View style={s.webMapFallback}>
            <MapPin size={40} color={Colors.primary} />
            <Text style={s.webMapText}>Map View</Text>
            <Text style={s.webMapSub}>Tap a stop below to explore</Text>
          </View>
        ) : (
          <MapLibreGL.MapView
            style={s.map}
            mapStyle="https://tiles.openfreemap.org/styles/liberty"
            onPress={onMapPress}
            logoEnabled={false}
            attributionEnabled={false}
          >
            <MapLibreGL.Camera
              ref={cameraRef}
              defaultSettings={{
                centerCoordinate: [mapCenter.longitude, mapCenter.latitude],
                zoomLevel: 12,
              }}
            />
            <MapLibreGL.UserLocation
              visible={!isPassengerOnBoard}
              renderMode="native"
              androidRenderMode="gps"
              showsUserHeadingIndicator
            />

            {isPassengerOnBoard && onboardDirections.geometry && (
              <MapLibreGL.ShapeSource
                id="home-active-trip-route"
                shape={{
                  type: "Feature",
                  geometry: onboardDirections.geometry,
                  properties: {},
                }}
              >
                <MapLibreGL.LineLayer
                  id="home-active-trip-route-line"
                  style={{
                    lineColor: Colors.primary,
                    lineWidth: 6,
                    lineOpacity: onboardDirections.isFallback ? 0.65 : 1,
                    lineCap: "round",
                    lineJoin: "round",
                    ...(onboardDirections.isFallback ? { lineDasharray: [2, 1.5] } : {}),
                  }}
                />
              </MapLibreGL.ShapeSource>
            )}

            {/* Only active bus markers on the map */}
            {busesForMap
              .filter((b) => b.lat !== 0 && b.lng !== 0)
              .map((bus) => (
                <MapLibreGL.MarkerView
                  key={bus.driver_id}
                  coordinate={[bus.lng, bus.lat]}
                  allowOverlap
                  isSelected
                >
                  <TouchableOpacity
                    onPress={() => isPassengerOnBoard && activeBooking && activeTargetStop
                      ? router.push({
                          pathname: "/tracking",
                          params: {
                            driverId: activeBooking.driver_id ?? "",
                            driverName: activeBooking.driver_name ?? bus.driver_name,
                            busReg: activeBooking.bus_registration ?? bus.bus_registration,
                            routeName: activeBooking.route_name ?? bus.route_name,
                            seats: String(bus.seats_available),
                            eta: String(bus.eta_minutes),
                            lat: String(bus.lat),
                            lng: String(bus.lng),
                            stopLat: String(activeTargetStop.lat),
                            stopLng: String(activeTargetStop.lng),
                            stopName: activeBooking.destination_stop_name,
                          },
                        })
                      : router.push("/find-route")}
                    activeOpacity={0.8}
                  >
                    <View style={s.busMarkerOuter}>
                      <View style={s.busMarkerCard}>
                        <Bus size={20} color={Colors.black} />
                        <View style={s.busMarkerSeatBadge}>
                          <Text style={s.busMarkerSeatTxt}>{bus.seats_available}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </MapLibreGL.MarkerView>
              ))
            }
          </MapLibreGL.MapView>
        )}
      </Animated.View>

      <View style={[s.topOverlay, { paddingTop: topInset + 10 }]} pointerEvents="box-none">
        <OfflineBanner isOffline={offline} lastUpdated="2 min ago" />
        <View style={s.topBar} pointerEvents="box-none">
          <View style={s.topRight}>
            <TouchableOpacity
              style={s.topIconBtn}
              onPress={() => router.push("/ride-notification")}
              activeOpacity={0.7}
            >
              <Bell size={18} color={Colors.gray700} />
              <View style={s.notifDot} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Animated.View
        pointerEvents="box-none"
        style={[
          s.locateFloating,
          {
            transform: [{ translateY: Animated.subtract(translateY, new Animated.Value(56)) }],
          },
        ]}
      >
        <TouchableOpacity style={s.locateBtn} onPress={recenterMap} activeOpacity={0.8}>
          <Locate size={20} color={Colors.gray700} />
        </TouchableOpacity>
      </Animated.View>

      <Animated.View
        style={[
          s.sheet,
          {
            transform: [{ translateY }],
            height: SCREEN_HEIGHT,
          },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={s.handleContainer}>
          <View style={s.handle} />
          <View style={s.handleHint}>
            <ChevronUp size={14} color={Colors.gray400} />
            <Text style={s.handleText}>Slide up for details</Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={s.sheetScroll}
          contentContainerStyle={s.sheetContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={scrollEnabled}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={doRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          onScrollEndDrag={(e) => {
            if (e.nativeEvent.contentOffset.y <= 0 && isScrollEnabled.current) {
              isScrollEnabled.current = false;
              setScrollEnabled(false);
            }
          }}
        >
          <TouchableOpacity
            style={s.searchBar}
            activeOpacity={0.85}
            onPress={() => router.push("/find-route")}
          >
            <View style={s.searchIconWrap}>
              <Search size={18} color={Colors.primary} />
            </View>
            <Text style={s.searchPH}>Where are you going?</Text>
          </TouchableOpacity>

          {activeBooking && (
            <ActiveRideCard booking={activeBooking} bus={activeBookingBus} targetStop={activeTargetStop} />
          )}

          <View style={s.quickRow}>
            <TouchableOpacity
              style={s.quickBtn}
              onPress={() => router.push("/set-bus-alert")}
              activeOpacity={0.7}
            >
              <View style={[s.quickIc, { backgroundColor: Colors.warningLight }]}>
                <BellRing size={18} color={Colors.warning} />
              </View>
              <Text style={s.quickLbl}>Bus{"\n"}Alert</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.quickBtn}
              onPress={() => router.push("/(tabs)/schedule")}
              activeOpacity={0.7}
            >
              <View style={[s.quickIc, { backgroundColor: Colors.infoLight }]}>
                <MapPin size={18} color={Colors.info} />
              </View>
              <Text style={s.quickLbl}>Schedule{"\n"}Ride</Text>
            </TouchableOpacity>
          </View>

          {(activeAlerts.length > 0 || triggeredAlerts.length > 0) && (
            <TouchableOpacity
              style={s.alertBanner}
              onPress={() => router.push("/my-alerts")}
              activeOpacity={0.7}
            >
              <View style={s.alertBannerLeft}>
                <BellRing size={18} color={Colors.primary} />
                <View>
                  <Text style={s.alertBannerTitle}>
                    {triggeredAlerts.length > 0
                      ? `${triggeredAlerts.length} alert${triggeredAlerts.length > 1 ? "s" : ""} triggered!`
                      : `${activeAlerts.length} active alert${activeAlerts.length > 1 ? "s" : ""}`}
                  </Text>
                  <Text style={s.alertBannerSub}>
                    {triggeredAlerts.length > 0
                      ? "Tap to view available buses"
                      : "We'll notify you when buses arrive"}
                  </Text>
                </View>
              </View>
              <View style={s.alertBannerDotBadge} />
            </TouchableOpacity>
          )}

          <View style={s.secHead}>
            <Text style={s.secTitle}>Recent Destinations</Text>
            <Text style={s.secCount}>{recentDestinations.length} recent</Text>
          </View>

          {bookingsError ? (
            <TouchableOpacity style={s.historyError} onPress={() => void refreshBookings()} activeOpacity={0.8}>
              <AlertCircle size={16} color={Colors.danger} />
              <Text style={s.historyErrorText}>Could not load recent destinations. Tap to retry.</Text>
            </TouchableOpacity>
          ) : null}

          {!bookingsError && recentDestinations.length === 0 ? (
            <View style={s.historyEmpty}>
              <Clock size={28} color={Colors.gray300} />
              <Text style={s.historyEmptyText}>
                Your recent destinations will show up here
              </Text>
            </View>
          ) : !bookingsError ? (
            recentDestinations.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={s.historyRow}
                activeOpacity={0.7}
                onPress={() => onSelectRecentDestination(b)}
              >
                <View style={s.historyIconWrap}>
                  <Clock size={16} color={Colors.gray500} />
                </View>
                <View style={s.historyTextWrap}>
                  <Text style={s.historyDest}>{b.destination_stop_name}</Text>
                  <Text style={s.historySub}>
                    {b.route_name ? `via ${b.route_name}` : "Tap to find buses"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : null}
          <View style={{ height: 100 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}



const make_s = (Colors: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.screenBg,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  map: {
    flex: 1,
  },
  webMapFallback: {
    flex: 1,
    backgroundColor: "#E8E4DF",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  webMapText: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.gray600,
  },
  webMapSub: {
    fontSize: 13,
    color: Colors.gray400,
  },
  topOverlay: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "transparent",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  topIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  notifDot: {
    position: "absolute" as const,
    top: 9,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    borderWidth: 1.5,
    borderColor: Colors.white,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.white,
    paddingLeft: 8,
    paddingRight: 18,
    paddingVertical: 8,
    borderRadius: 999,
    marginHorizontal: 20,
    marginBottom: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
  searchIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  searchPH: {
    fontSize: 15,
    color: Colors.gray500,
    fontWeight: "500" as const,
  },

  locateFloating: {
    position: "absolute" as const,
    right: 16,
    top: 0,
    zIndex: 150,
  },
  locateBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  sheet: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    backgroundColor: Colors.screenBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 100,
    ...(Platform.OS === "web" ? ({ cursor: "grab" } as unknown as { cursor?: "auto" | "pointer" }) : {}),
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.gray300,
  },
  handleHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  handleText: {
    fontSize: 11,
    color: Colors.gray400,
    fontWeight: "500" as const,
  },
  sheetScroll: {
    flex: 1,
  },
  sheetContent: {
    paddingTop: 4,
  },

  quickRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 18,
  },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  quickIc: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLbl: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.gray700,
    lineHeight: 16,
  },
  secHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  secTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.gray800,
  },
  secCount: {
    fontSize: 13,
    color: Colors.gray400,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  historyIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  historyTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  historyDest: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.gray800,
  },
  historySub: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 1,
  },
  historyEmpty: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 40,
    gap: 8,
  },
  historyError: {
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dangerLight,
  },
  historyErrorText: {
    flex: 1,
    color: Colors.danger,
    fontSize: 13,
    fontWeight: "600" as const,
  },
  historyEmptyText: {
    fontSize: 13,
    color: Colors.gray400,
    textAlign: "center" as const,
  },
  alertBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.primaryFaded,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary + "30",
  },
  alertBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  alertBannerTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.primaryDark,
  },
  alertBannerSub: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 1,
  },
  alertBannerDotBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },

  markerOuter: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  markerSelected: {
    transform: [{ scale: 1.25 }],
  },
  markerCard: {
    width: 40,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 5,
  },
  markerCardActive: {
    backgroundColor: Colors.primary,
  },
  markerCardInactive: {
    backgroundColor: Colors.gray300,
  },
  markerCardSelected: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryLight,
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 9,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -1,
  },
  markerBadge: {
    position: "absolute" as const,
    top: -5,
    right: -6,
    backgroundColor: Colors.success,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.white,
    paddingHorizontal: 3,
    zIndex: 1,
  },
  markerBadgeText: {
    fontSize: 10,
    fontWeight: "700" as const,
    color: Colors.white,
  },

  // Live bus markers — circular badge (orange fill, black ring)
  busMarkerOuter: {
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  busMarkerCard: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.black,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 5,
    elevation: 6,
  },
  busMarkerSeatBadge: {
    position: "absolute" as const,
    top: -6,
    right: -6,
    backgroundColor: Colors.success,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: Colors.white,
    paddingHorizontal: 3,
  },
  busMarkerSeatTxt: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: Colors.white,
  },
});

let s: ReturnType<typeof make_s> = make_s(StaticColors as unknown as ThemePalette);
