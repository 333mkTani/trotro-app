import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  MapPin,
  Navigation2,
  Clock,
  Bus,
  AlertTriangle,
  LocateFixed,
  Footprints,
  ChevronRight,
  Compass,
  ArrowUp,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { getStopById } from "@/mocks/stops";
const Colors = StaticColors;

type Params = {
  stopId: string;
  stopName: string;
  bookingId: string;
  busReg?: string;
  driverName?: string;
  routeName?: string;
  eta?: string;
};

const ACCRA_CENTER = { lat: 5.5913, lng: -0.2217 };

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function estimateWalkMin(meters: number): number {
  return Math.max(1, Math.round(meters / 80));
}

export default function NavigateToPickupScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const stop = useMemo(() => getStopById(params.stopId ?? ""), [params.stopId]);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    let mounted = true;

    const getLocation = async () => {
      try {
        if (Platform.OS === "web") {
          if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (mounted) {
                  setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                  setLocationLoading(false);
                  console.log("[NavigateToPickup] Web location:", pos.coords.latitude, pos.coords.longitude);
                }
              },
              () => {
                if (mounted) {
                  setUserLocation({ lat: ACCRA_CENTER.lat + 0.003, lng: ACCRA_CENTER.lng + 0.002 });
                  setLocationLoading(false);
                  setLocationError("Using approximate location");
                  console.log("[NavigateToPickup] Web geolocation fallback");
                }
              },
              { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
            );
          } else {
            setUserLocation({ lat: ACCRA_CENTER.lat + 0.003, lng: ACCRA_CENTER.lng + 0.002 });
            setLocationLoading(false);
          }
        } else {
          const Location = await import("expo-location");
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            if (mounted) {
              setLocationError("Location permission denied");
              setUserLocation({ lat: ACCRA_CENTER.lat + 0.003, lng: ACCRA_CENTER.lng + 0.002 });
              setLocationLoading(false);
            }
            return;
          }
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (mounted) {
            setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            setLocationLoading(false);
            console.log("[NavigateToPickup] Native location:", loc.coords.latitude, loc.coords.longitude);
          }
        }
      } catch (e) {
        console.log("[NavigateToPickup] Location error:", e);
        if (mounted) {
          setUserLocation({ lat: ACCRA_CENTER.lat + 0.003, lng: ACCRA_CENTER.lng + 0.002 });
          setLocationLoading(false);
          setLocationError("Could not get exact location");
        }
      }
    };

    getLocation();
    return () => { mounted = false; };
  }, []);

  const distance = useMemo(() => {
    if (!userLocation || !stop) return null;
    return haversineDistance(userLocation.lat, userLocation.lng, stop.lat, stop.lng);
  }, [userLocation, stop]);

  const walkMin = useMemo(() => (distance != null ? estimateWalkMin(distance) : null), [distance]);

  useEffect(() => {
    if (distance != null) {
      const progress = Math.min(1, Math.max(0.05, 1 - distance / 3000));
      Animated.timing(progressAnim, { toValue: progress, duration: 800, useNativeDriver: false }).start();
    }
  }, [distance]);

  const bearing = useMemo(() => {
    if (!userLocation || !stop) return 0;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const toDeg = (r: number) => (r * 180) / Math.PI;
    const dLng = toRad(stop.lng - userLocation.lng);
    const y = Math.sin(dLng) * Math.cos(toRad(stop.lat));
    const x =
      Math.cos(toRad(userLocation.lat)) * Math.sin(toRad(stop.lat)) -
      Math.sin(toRad(userLocation.lat)) * Math.cos(toRad(stop.lat)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }, [userLocation, stop]);

  const bearingLabel = useMemo(() => {
    const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    return dirs[Math.round(bearing / 45) % 8];
  }, [bearing]);

  const busEta = parseInt(params.eta ?? "0", 10);

  if (!stop) {
    return (
      <View style={st.root}>
        <Stack.Screen options={{ title: "Navigate to Stop" }} />
        <View style={st.errorContainer}>
          <MapPin size={48} color={Colors.gray300} />
          <Text style={st.errorTitle}>Stop not found</Text>
          <TouchableOpacity style={st.backBtn} onPress={() => router.back()}>
            <Text style={st.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={st.root}>
      <Stack.Screen
        options={{
          title: "Navigate to Stop",
          headerStyle: { backgroundColor: Colors.screenBg },
          headerTintColor: Colors.primary,
          headerShadowVisible: false,
        }}
      />
      <Animated.ScrollView
        style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}
        contentContainerStyle={st.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        <View style={st.mapContainer}>
          <View style={st.mapPlaceholder}>
            <View style={st.mapGrid}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={`h-${i}`} style={[st.mapGridLineH, { top: `${(i + 1) * 14}%` }]} />
              ))}
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={`v-${i}`} style={[st.mapGridLineV, { left: `${(i + 1) * 14}%` }]} />
              ))}
            </View>

            {userLocation && (
              <Animated.View style={[st.userPin, { transform: [{ scale: pulseAnim }] }]}>
                <View style={st.userPinInner}>
                  <LocateFixed size={16} color={Colors.white} />
                </View>
                <View style={st.userPinRing} />
              </Animated.View>
            )}

            <View style={st.routeLine} />

            <View style={st.stopPin}>
              <View style={st.stopPinInner}>
                <MapPin size={18} color={Colors.white} />
              </View>
              <View style={st.stopPinShadow} />
            </View>

            {locationLoading && (
              <View style={st.mapOverlay}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={st.mapOverlayText}>Getting your location...</Text>
              </View>
            )}
          </View>

          <View style={st.directionBar}>
            <Compass size={16} color={Colors.white} />
            <Text style={st.directionBarText}>Head {bearingLabel} toward {stop.name}</Text>
          </View>
        </View>

        <View style={st.destCard}>
          <View style={st.destCardHeader}>
            <View style={st.destIconWrap}>
              <MapPin size={20} color={Colors.primary} />
            </View>
            <View style={st.destCardInfo}>
              <Text style={st.destCardLabel}>Walking to</Text>
              <Text style={st.destCardName}>{stop.name}</Text>
            </View>
            <View style={st.destBadge}>
              <Footprints size={14} color={Colors.info} />
              <Text style={st.destBadgeText}>Walk</Text>
            </View>
          </View>

          {distance != null && (
            <View style={st.progressSection}>
              <View style={st.progressBar}>
                <Animated.View style={[st.progressFill, { width: progressWidth }]} />
              </View>
              <View style={st.progressStats}>
                <View style={st.progressStat}>
                  <Footprints size={14} color={Colors.gray500} />
                  <Text style={st.progressStatValue}>{formatDistance(distance)}</Text>
                  <Text style={st.progressStatLabel}>distance</Text>
                </View>
                <View style={st.progressStatDivider} />
                <View style={st.progressStat}>
                  <Clock size={14} color={Colors.gray500} />
                  <Text style={st.progressStatValue}>~{walkMin} min</Text>
                  <Text style={st.progressStatLabel}>walk time</Text>
                </View>
              </View>
            </View>
          )}

          {locationError && (
            <View style={st.locationWarning}>
              <AlertTriangle size={12} color={Colors.warning} />
              <Text style={st.locationWarningText}>{locationError}</Text>
            </View>
          )}
        </View>

        {(params.busReg || params.routeName) && (
          <View style={st.busInfoCard}>
            <View style={st.busInfoHeader}>
              <View style={st.busInfoIcon}>
                <Bus size={18} color={Colors.white} />
              </View>
              <View style={st.busInfoText}>
                <Text style={st.busInfoTitle}>Your Bus</Text>
                <Text style={st.busInfoSub}>{params.busReg}</Text>
              </View>
              {busEta > 0 && (
                <View style={st.etaBadge}>
                  <Text style={st.etaBadgeNum}>{busEta}</Text>
                  <Text style={st.etaBadgeUnit}>min</Text>
                </View>
              )}
            </View>

            <View style={st.busInfoDivider} />

            <View style={st.busInfoRows}>
              {params.driverName ? (
                <View style={st.busInfoRow}>
                  <Text style={st.busInfoRowLabel}>Driver</Text>
                  <Text style={st.busInfoRowValue}>{params.driverName}</Text>
                </View>
              ) : null}
              {params.routeName ? (
                <View style={st.busInfoRow}>
                  <Text style={st.busInfoRowLabel}>Route</Text>
                  <Text style={st.busInfoRowValue}>{params.routeName}</Text>
                </View>
              ) : null}
              {busEta > 0 ? (
                <View style={st.busInfoRow}>
                  <Text style={st.busInfoRowLabel}>Arrives at stop</Text>
                  <Text style={st.busInfoRowValue}>~{busEta} min</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

        <View style={st.warningBanner}>
          <AlertTriangle size={14} color={Colors.danger} />
          <Text style={st.warningText}>
            The bus will not wait at the stop upon arrival. Please arrive at {stop.name} before the bus.
          </Text>
        </View>

        <View style={st.etaDisclaimer}>
          <Clock size={12} color={Colors.gray400} />
          <Text style={st.etaDisclaimerText}>
            Estimated arrival based on traffic conditions
          </Text>
        </View>

        {walkMin != null && busEta > 0 && walkMin > busEta && (
          <View style={st.urgentBanner}>
            <AlertTriangle size={16} color={Colors.white} />
            <View style={st.urgentTextWrap}>
              <Text style={st.urgentTitle}>You may not make it in time!</Text>
              <Text style={st.urgentSub}>
                Walk time (~{walkMin} min) exceeds bus arrival (~{busEta} min). Consider running or using a taxi.
              </Text>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </Animated.ScrollView>

      <View style={st.footer}>
        <TouchableOpacity
          style={st.navButton}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.back();
            console.log("[NavigateToPickup] Returned to previous screen");
          }}
          activeOpacity={0.7}
          testID="navigate-btn"
        >
          <ArrowUp size={20} color={Colors.white} style={{ transform: [{ rotate: `${bearing}deg` }] }} />
          <Text style={st.navButtonText}>Head {bearingLabel} · {distance != null ? formatDistance(distance) : "..."}</Text>
          <ChevronRight size={18} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>
    </View>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.screenBg,
  },
  scrollInner: {
    paddingBottom: 20,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.gray600,
    marginTop: 16,
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  mapContainer: {
    margin: 16,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 6,
  },
  mapPlaceholder: {
    height: 220,
    backgroundColor: "#E8F4E8",
    position: "relative",
    overflow: "hidden",
  },
  mapGrid: {
    ...StyleSheet.absoluteFillObject,
  },
  mapGridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(46,125,50,0.08)",
  },
  mapGridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(46,125,50,0.08)",
  },
  userPin: {
    position: "absolute",
    bottom: "55%",
    left: "25%",
    alignItems: "center",
    justifyContent: "center",
  },
  userPinInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.info,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.white,
    zIndex: 2,
  },
  userPinRing: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(37,99,235,0.15)",
  },
  routeLine: {
    position: "absolute",
    bottom: "35%",
    left: "30%",
    width: "40%",
    height: 3,
    backgroundColor: Colors.primary,
    borderRadius: 2,
    transform: [{ rotate: "-25deg" }],
  },
  stopPin: {
    position: "absolute",
    top: "25%",
    right: "20%",
    alignItems: "center",
  },
  stopPinInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: Colors.white,
    zIndex: 2,
  },
  stopPinShadow: {
    width: 20,
    height: 6,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.1)",
    marginTop: 4,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  mapOverlayText: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 8,
  },
  directionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.secondary,
    paddingVertical: 13,
  },
  directionBarText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  destCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  destCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  destIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  destCardInfo: {
    flex: 1,
    marginLeft: 12,
  },
  destCardLabel: {
    fontSize: 11,
    color: Colors.gray400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  destCardName: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.gray800,
    marginTop: 2,
  },
  destBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  destBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.info,
  },
  progressSection: {
    marginTop: 16,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.gray100,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
  },
  progressStat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  progressStatValue: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: Colors.gray800,
  },
  progressStatLabel: {
    fontSize: 12,
    color: Colors.gray400,
  },
  progressStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.gray200,
    marginHorizontal: 8,
  },
  locationWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  locationWarningText: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: "500" as const,
  },
  busInfoCard: {
    marginHorizontal: 16,
    marginBottom: 14,
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  busInfoHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  busInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  busInfoText: {
    flex: 1,
    marginLeft: 12,
  },
  busInfoTitle: {
    fontSize: 11,
    color: Colors.gray400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  busInfoSub: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: Colors.gray800,
    marginTop: 1,
  },
  etaBadge: {
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
  },
  etaBadgeNum: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: Colors.primary,
  },
  etaBadgeUnit: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  busInfoDivider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginHorizontal: 16,
  },
  busInfoRows: {
    padding: 16,
    gap: 10,
  },
  busInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  busInfoRowLabel: {
    fontSize: 13,
    color: Colors.gray500,
  },
  busInfoRowValue: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.gray800,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    backgroundColor: Colors.dangerLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.danger + "20",
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: Colors.danger,
    fontWeight: "500" as const,
    lineHeight: 17,
  },
  etaDisclaimer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingVertical: 8,
  },
  etaDisclaimerText: {
    fontSize: 11,
    color: Colors.gray400,
    fontStyle: "italic" as const,
  },
  urgentBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
    backgroundColor: Colors.danger,
    borderRadius: 14,
  },
  urgentTextWrap: {
    flex: 1,
  },
  urgentTitle: {
    fontSize: 14,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  urgentSub: {
    fontSize: 12,
    color: "rgba(255,255,255,0.85)",
    marginTop: 3,
    lineHeight: 17,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
    flex: 1,
    textAlign: "center",
  },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
