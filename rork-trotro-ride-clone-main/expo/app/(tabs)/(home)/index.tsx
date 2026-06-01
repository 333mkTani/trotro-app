import React, { useState, useCallback, useMemo, useRef } from "react";
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
import { MapPin, Navigation, Search, Bell, Route, BellRing, ChevronUp, Locate, Bus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBusAlerts } from "@/contexts/BusAlertContext";
import { useLocation } from "@/contexts/LocationContext";
import { MOCK_APPROACHING_BUSES } from "@/mocks/data";
import { ApproachingBus, BusStop } from "@/types";
import StopCard from "@/components/StopCard";
import OfflineBanner from "@/components/OfflineBanner";
const Colors = StaticColors;

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");



export default function HomeScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  s = React.useMemo(() => make_s(themeColors), [themeColors]);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { activeAlerts, triggeredAlerts } = useBusAlerts();
  const { regionStops, activeBuses, regionName, mapCenter, refreshLocation } = useLocation();
  const [refreshing, setRefreshing] = useState(false);
  const [offline] = useState(false);
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const mapRef = useRef<MapView>(null);
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

  const sortedStops = useMemo(() => {
    const mapped = regionStops.map((stop) => ({
      ...stop,
      distance_m: Math.floor(Math.random() * 3000 + 200),
    }));
    mapped.sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0));
    return mapped;
  }, [regionStops]);

  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise((r) => setTimeout(r, 1200));
    setRefreshing(false);
  }, []);

  const onBusPress = useCallback(
    (b: ApproachingBus, stop: BusStop) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/tracking",
        params: {
          driverId: b.driver_id,
          driverName: b.driver_name,
          busReg: b.bus_registration,
          routeName: b.route_name,
          seats: String(b.seats_available),
          eta: String(b.eta_minutes),
          lat: String(b.lat),
          lng: String(b.lng),
          stopLat: String(stop.lat),
          stopLng: String(stop.lng),
          stopName: stop.name,
        },
      });
    },
    [router]
  );

  const onBookBus = useCallback(
    (bus: ApproachingBus, stop: BusStop) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log("[Home] Book bus:", bus.bus_registration, "at", stop.name);
      router.push({
        pathname: "/book-bus",
        params: {
          driverId: bus.driver_id,
          driverName: bus.driver_name,
          busReg: bus.bus_registration,
          routeName: bus.route_name,
          seats: String(bus.seats_available),
          eta: String(bus.eta_minutes),
          stopId: stop.id,
          stopName: stop.name,
        },
      });
    },
    [router]
  );

  const onStopMarkerPress = useCallback(
    (stop: BusStop) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelectedStop(stop.id);
      snapTo(SNAP_MID);
    },
    [snapTo, SNAP_MID]
  );

  const onMapPress = useCallback(() => {
    setSelectedStop(null);
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
        if (mapRef.current) {
          mapRef.current.animateToRegion(mapCenter, 500);
        }
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      console.log("[Home] Current location:", location.coords.latitude, location.coords.longitude);

      if (mapRef.current) {
        mapRef.current.animateToRegion(
          {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          },
          500
        );
      }
    } catch (err) {
      console.log("[Home] Location error, falling back to default:", err);
      if (mapRef.current) {
        mapRef.current.animateToRegion(mapCenter, 500);
      }
    }
  }, [mapCenter]);

  const name = user?.full_name?.split(" ")[0] ?? "Traveller";

  const { greetLabel, greetEmoji } = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return { greetLabel: "Good night,", greetEmoji: "🌙" };
    if (h < 12) return { greetLabel: "Good morning,", greetEmoji: "👋" };
    if (h < 17) return { greetLabel: "Good afternoon,", greetEmoji: "☀️" };
    if (h < 21) return { greetLabel: "Good evening,", greetEmoji: "🌆" };
    return { greetLabel: "Good night,", greetEmoji: "🌙" };
  }, []);

  const mapInputMin = Math.min(SNAP_TOP, SNAP_MID);
  const mapInputMax = Math.max(SNAP_TOP, SNAP_MID);
  const mapOpacity = translateY.interpolate({
    inputRange: [mapInputMin, mapInputMax],
    outputRange: SNAP_TOP <= SNAP_MID ? [0.4, 1] : [1, 0.4],
    extrapolate: "clamp",
  });

  const filteredStops = useMemo(() => {
    if (!selectedStop) return sortedStops;
    const sel = sortedStops.find((s) => s.id === selectedStop);
    if (sel) return [sel, ...sortedStops.filter((s) => s.id !== selectedStop)];
    return sortedStops;
  }, [selectedStop, sortedStops]);

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
          <MapView
            ref={mapRef}
            style={s.map}
            initialRegion={mapCenter}
            onPress={onMapPress}
            showsUserLocation
            showsMyLocationButton={false}
            toolbarEnabled={false}
            mapPadding={{ top: topInset + 60, right: 0, bottom: SCREEN_HEIGHT * 0.5, left: 0 }}
          >
            {/* Live bus markers — only rendered when lat/lng is known */}
            {activeBuses
              .filter((b) => b.lat !== 0 && b.lng !== 0 && b.seats_available > 0)
              .map((bus) => (
                <Marker
                  key={bus.driver_id}
                  coordinate={{ latitude: bus.lat, longitude: bus.lng }}
                  tracksViewChanges={false}
                  onPress={() => router.push({
                    pathname: "/book-bus",
                    params: {
                      driverId: bus.driver_id,
                      driverName: bus.driver_name,
                      busReg: bus.bus_registration,
                      routeName: bus.route_name,
                      seats: String(bus.seats_available),
                      eta: String(bus.eta_minutes),
                    },
                  })}
                >
                  <View style={s.busMarkerOuter}>
                    <View style={s.busMarkerCard}>
                      <Bus size={14} color={Colors.white} />
                      <Text style={s.busMarkerSeats}>{bus.seats_available}</Text>
                    </View>
                    <View style={s.busMarkerTail} />
                  </View>
                </Marker>
              ))
            }

            {sortedStops.map((stop) => {
              const buses = MOCK_APPROACHING_BUSES[stop.id] ?? [];
              const activeBusCount = buses.filter((b) => b.seats_available > 0).length;
              const isSelected = selectedStop === stop.id;

              return (
                <Marker
                  key={stop.id}
                  coordinate={{ latitude: stop.lat, longitude: stop.lng }}
                  onPress={() => onStopMarkerPress(stop)}
                  tracksViewChanges={false}
                >
                  <View style={[s.markerOuter, isSelected && s.markerSelected]}>
                    {/* Bus count badge */}
                    {activeBusCount > 0 && (
                      <View style={s.markerBadge}>
                        <Text style={s.markerBadgeText}>{activeBusCount}</Text>
                      </View>
                    )}
                    {/* Speech-bubble card */}
                    <View style={[
                      s.markerCard,
                      activeBusCount > 0 ? s.markerCardActive : s.markerCardInactive,
                      isSelected && s.markerCardSelected,
                    ]}>
                      <Bus
                        size={18}
                        color={activeBusCount > 0 ? Colors.white : Colors.gray500}
                      />
                    </View>
                    {/* Pointed tail */}
                    <View style={[
                      s.markerTail,
                      { borderTopColor: isSelected ? Colors.primaryDark : activeBusCount > 0 ? Colors.primary : Colors.gray400 },
                    ]} />
                  </View>
                </Marker>
              );
            })}
          </MapView>
        )}
      </Animated.View>

      <View style={[s.topOverlay, { paddingTop: topInset + 10 }]} pointerEvents="box-none">
        <OfflineBanner isOffline={offline} lastUpdated="2 min ago" />
        <View style={s.topBar} pointerEvents="box-none">
          <View style={s.floatingLogo}>
            <View style={s.logoDot} />
            <Text style={s.logoText}>Trotro</Text>
          </View>
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
          <View style={s.greeting}>
            <View>
              <Text style={s.greetLabel}>{greetLabel}</Text>
              <Text style={s.greetName}>{name} {greetEmoji}</Text>
            </View>
          </View>

          <View style={s.locChip}>
            <Navigation size={14} color={Colors.primary} />
            <Text style={s.locText}>{regionName}</Text>
          </View>

          <View style={s.quickRow}>
            <TouchableOpacity
              style={s.quickBtn}
              onPress={() => router.push("/find-route")}
              activeOpacity={0.7}
            >
              <View style={[s.quickIc, { backgroundColor: Colors.primaryFaded }]}>
                <Route size={18} color={Colors.primary} />
              </View>
              <Text style={s.quickLbl}>Find{"\n"}Route</Text>
            </TouchableOpacity>
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
            <Text style={s.secTitle}>
              {selectedStop ? "Selected Stop" : "Nearby Stops"}
            </Text>
            <Text style={s.secCount}>{filteredStops.length} stops</Text>
          </View>

          {filteredStops.map((stop) => (
            <StopCard
              key={stop.id}
              stop={stop}
              buses={MOCK_APPROACHING_BUSES[stop.id] ?? []}
              onPress={() => {
                setSelectedStop(stop.id);
                if (Platform.OS !== "web" && mapRef.current) {
                  mapRef.current.animateToRegion(
                    {
                      latitude: stop.lat,
                      longitude: stop.lng,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    },
                    400
                  );
                }
              }}
              onBusPress={onBusPress}
              onBookBus={onBookBus}
            />
          ))}
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
    justifyContent: "space-between",
    marginBottom: 12,
  },
  floatingLogo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  logoText: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: Colors.gray800,
    letterSpacing: -0.5,
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
    ...(Platform.OS === "web" ? { cursor: "grab" as const } : {}),
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

  greeting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  greetLabel: {
    fontSize: 13,
    color: Colors.gray500,
  },
  greetName: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.gray800,
    marginTop: 1,
  },
  locChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 14,
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: "flex-start" as const,
  },
  locText: {
    fontSize: 12,
    fontWeight: "500" as const,
    color: Colors.primaryDark,
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

  // Live bus markers
  busMarkerOuter: {
    alignItems: "center",
  },
  busMarkerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  busMarkerSeats: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  busMarkerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: Colors.success,
    marginTop: -1,
  },
});

let s: ReturnType<typeof make_s> = make_s(StaticColors as unknown as ThemePalette);
