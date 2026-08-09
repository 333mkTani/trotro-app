import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import MapLibreGL from "@maplibre/maplibre-react-native";
import {
  Bus,
  Users,
  Clock,
  MapPin,
  Navigation,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Radio,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { api } from "@/services/api";
import {
  connectSocket,
  disconnectSocket,
  getSocket,
  subscribeToBus,
  unsubscribeFromBus,
  type BusLocationEvent,
} from "@/services/socket";
import { useDirections } from "@/hooks/useDirections";
import { getActiveRouteStep, getRouteBounds } from "@/utils/routeGeometry";

type TrackingParams = {
  driverId: string;
  driverName: string;
  busReg: string;
  routeName: string;
  seats: string;
  eta: string;
  lat: string;
  lng: string;
  stopLat: string;
  stopLng: string;
  stopName: string;
};

function validLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

function validLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

function interpolateCoords(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
  progress: number
): { lat: number; lng: number } {
  return {
    lat: startLat + (endLat - startLat) * progress,
    lng: startLng + (endLng - startLng) * progress,
  };
}

function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function TrackingScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const p = useLocalSearchParams<TrackingParams>();
  const cameraRef = useRef<React.ComponentRef<typeof MapLibreGL.Camera>>(null);

  // Stop coords always come from a real selected bus stop, so they're the reliable anchor.
  const parsedStopLat = Number(p.stopLat);
  const parsedStopLng = Number(p.stopLng);
  const stopLat = validLatitude(parsedStopLat) ? parsedStopLat : 5.575;
  const stopLng = validLongitude(parsedStopLng) ? parsedStopLng : -0.205;
  // A bus with no live GPS fix yet reports lat/lng as 0 — placing it near the stop
  // (rather than a fixed Accra fallback) keeps the map sane for trips anywhere in Ghana.
  const parsedBusLat = Number(p.lat);
  const parsedBusLng = Number(p.lng);
  const busHasLiveFix =
    validLatitude(parsedBusLat) &&
    validLongitude(parsedBusLng) &&
    parsedBusLat !== 0 &&
    parsedBusLng !== 0;
  const busStartLat = busHasLiveFix ? parsedBusLat : stopLat + 0.015;
  const busStartLng = busHasLiveFix ? parsedBusLng : stopLng + 0.01;
  const initialEta = Number(p.eta) || 10;
  const seats = Number(p.seats) || 0;
  const stopName = p.stopName || "Bus Stop";
  const driverName = p.driverName || "Driver";
  const busReg = p.busReg || "GR-0000-00";
  const routeName = p.routeName || "Unknown Route";

  const [eta, setEta] = useState(initialEta);
  const [busPosition, setBusPosition] = useState({ lat: busStartLat, lng: busStartLng });
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("Just now");
  const [socketLive, setSocketLive] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const busIdRef = useRef<string | null>(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const liveDot = useRef(new Animated.Value(0.4)).current;

  const routingOrigin = useMemo(
    () => ({ latitude: busPosition.lat, longitude: busPosition.lng }),
    [busPosition],
  );
  const routingDestination = useMemo(
    () => ({ latitude: stopLat, longitude: stopLng }),
    [stopLat, stopLng],
  );
  const directions = useDirections({
    origin: routingOrigin,
    destination: routingDestination,
    profile: "driving",
    movementThresholdMeters: 100,
    staleTimeMs: 30_000,
  });
  const routePoints = useMemo(
    () => directions.geometry?.coordinates.map(([longitude, latitude]) => ({ latitude, longitude })) ?? [],
    [directions.geometry],
  );
  const routeBounds = useMemo(() => getRouteBounds(directions.geometry), [directions.geometry]);
  const displayedEta = directions.data?.durationSeconds != null
    ? Math.max(1, Math.ceil(directions.data.durationSeconds / 60))
    : eta;
  const activeStep = useMemo(
    () => directions.data
      ? getActiveRouteStep(directions.data.steps, routingOrigin, directions.data.geometry)
      : null,
    [routingOrigin, directions.data],
  );
  const nextInstruction = activeStep?.instruction ?? `Continue toward ${stopName}`;

  useEffect(() => {
    Animated.timing(sheetAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();

    const liveBlink = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDot, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(liveDot, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    );
    liveBlink.start();

    return () => {
      pulse.stop();
      liveBlink.stop();
    };
  }, [liveDot, pulseAnim, sheetAnim]);

  const totalDistM = useMemo(
    () => haversineMetres(busStartLat, busStartLng, stopLat, stopLng),
    [busStartLat, busStartLng, stopLat, stopLng]
  );

  const applyRealPosition = useCallback((realLat: number, realLng: number) => {
    if (!validLatitude(realLat) || !validLongitude(realLng)) return;
    setBusPosition({ lat: realLat, lng: realLng });

    const distToStop = haversineMetres(realLat, realLng, stopLat, stopLng);
    const etaMins = Math.max(1, Math.round(distToStop / 250)); // ~15 km/h
    setEta(etaMins);

    const newProgress = totalDistM > 0
      ? Math.min(1, Math.max(0, 1 - distToStop / totalDistM))
      : 0;
    setProgress(newProgress);
    setLastUpdate("Just now");

    if (newProgress >= 0.98 && Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [stopLat, stopLng, totalDistM]);

  // Real-time bus position via Socket.IO, subscribed to this bus's room.
  useEffect(() => {
    const driverId = p.driverId;
    if (!driverId) return;

    let cancelled = false;
    let busId: string | null = null;

    const onLocation = (event: BusLocationEvent) => {
      if (!busId || event.busId !== busId) return;
      applyRealPosition(event.lat, event.lng);
    };

    const setup = async () => {
      try {
        const { data } = await api.get(`/buses/driver/${driverId}/location`);
        if (cancelled) return;
        busId = (data?.bus_id as string | undefined) ?? null;
        if (!busId) return;
        busIdRef.current = busId;

        await connectSocket();
        if (cancelled) return;

        subscribeToBus(busId);
        const socket = getSocket();
        socket?.on("bus:location", onLocation);
        socket?.on("connect", () => setSocketLive(true));
        socket?.on("disconnect", () => setSocketLive(false));
        setSocketLive(socket?.connected ?? false);
      } catch {
        // No socket connection — REST polling below still covers tracking.
      }
    };

    setup();

    return () => {
      cancelled = true;
      const socket = getSocket();
      socket?.off("bus:location", onLocation);
      if (busId) unsubscribeFromBus(busId);
      setSocketLive(false);
    };
  }, [p.driverId, applyRealPosition]);

  useEffect(() => {
    return () => disconnectSocket();
  }, []);

  // REST fallback: keeps tracking working if the socket is unavailable, and
  // simulates motion when no real GPS reading exists yet.
  useEffect(() => {
    const driverId = p.driverId;
    let simElapsed = 0;
    const simTickMs = 4000;

    const poll = async () => {
      if (socketLive) return; // socket is delivering live updates already
      try {
        if (!driverId) throw new Error("no driverId");
        const { data } = await api.get(`/buses/driver/${driverId}/location`);
        const realLat = parseFloat(data.lat);
        const realLng = parseFloat(data.lng);

        if (
          validLatitude(realLat) &&
          validLongitude(realLng) &&
          realLat !== 0 &&
          realLng !== 0
        ) {
          applyRealPosition(realLat, realLng);
          return;
        }
      } catch { /* fall through to simulation */ }

      // Simulation fallback when real GPS unavailable
      simElapsed += simTickMs;
      const newProgress = Math.min(1, simElapsed / (initialEta * 60 * 1000));
      const newPos = interpolateCoords(busStartLat, busStartLng, stopLat, stopLng, newProgress);
      setBusPosition({ lat: newPos.lat, lng: newPos.lng });
      setProgress(newProgress);
      setEta(Math.max(1, Math.round(initialEta * (1 - newProgress))));
      const secs = Math.floor(simElapsed / 1000);
      setLastUpdate(secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`);
    };

    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, [busStartLat, busStartLng, stopLat, stopLng, initialEta, p.driverId, socketLive, applyRealPosition]);

  const mapRegion = useMemo(() => {
    const centerLat = (busStartLat + stopLat) / 2;
    const centerLng = (busStartLng + stopLng) / 2;
    const latDelta = Math.abs(busStartLat - stopLat) * 2.2 + 0.005;
    const lngDelta = Math.abs(busStartLng - stopLng) * 2.2 + 0.005;
    return {
      latitude: centerLat,
      longitude: centerLng,
      latitudeDelta: Math.max(latDelta, 0.01),
      longitudeDelta: Math.max(lngDelta, 0.01),
    };
  }, [busStartLat, busStartLng, stopLat, stopLng]);

  const recenterMap = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!routeBounds) return;
    cameraRef.current?.fitBounds(
      [routeBounds.northEast.longitude, routeBounds.northEast.latitude],
      [routeBounds.southWest.longitude, routeBounds.southWest.latitude],
      [80, 60, 200, 60], // padding [top, right, bottom, left]
      500
    );
  }, [routeBounds]);

  useEffect(() => {
    if (Platform.OS === "web" || !mapReady || !routeBounds) return;
    cameraRef.current?.fitBounds(
      [routeBounds.northEast.longitude, routeBounds.northEast.latitude],
      [routeBounds.southWest.longitude, routeBounds.southWest.latitude],
      [80, 60, 200, 60],
      500,
    );
  }, [mapReady, routeBounds]);

  const toggleExpand = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded((v) => !v);
  }, []);

  const etaColor = displayedEta <= 3 ? Colors.success : displayedEta <= 7 ? Colors.warning : Colors.primary;

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [300, 0],
  });

  return (
    <View style={st.root}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {Platform.OS !== "web" ? (
        <MapLibreGL.MapView
          style={StyleSheet.absoluteFillObject}
          mapStyle="https://tiles.openfreemap.org/styles/liberty"
          logoEnabled={false}
          attributionEnabled={false}
          onDidFinishLoadingMap={() => setMapReady(true)}
        >
          <MapLibreGL.Camera
            ref={cameraRef}
            centerCoordinate={[mapRegion.longitude, mapRegion.latitude]}
            zoomLevel={13}
            animationDuration={0}
          />

          {routePoints.length > 1 && directions.geometry && (
            <MapLibreGL.ShapeSource
              id="route-to-stop"
              shape={{
                type: "Feature",
                geometry: directions.geometry,
                properties: {},
              }}
            >
              <MapLibreGL.LineLayer
                id="route-to-stop-line"
                style={{
                  lineColor: Colors.primary,
                  lineWidth: 5,
                  lineOpacity: directions.isFallback ? 0.7 : 1,
                  ...(directions.isFallback ? { lineDasharray: [2, 1.5] } : {}),
                }}
              />
            </MapLibreGL.ShapeSource>
          )}

          {/* Stop marker */}
          <MapLibreGL.MarkerView coordinate={[stopLng, stopLat]}>
            <View style={st.stopMarker}>
              <View style={st.stopMarkerInner}>
                <MapPin size={16} color={Colors.white} />
              </View>
              <View style={st.stopMarkerTail} />
            </View>
          </MapLibreGL.MarkerView>

          {/* Bus marker */}
          <MapLibreGL.MarkerView coordinate={[busPosition.lng, busPosition.lat]}>
            <View style={st.busMarkerWrap}>
              <View style={st.busMarkerPulse} />
              <View style={st.busMarkerCore}>
                <Bus size={18} color={Colors.white} />
              </View>
            </View>
          </MapLibreGL.MarkerView>
        </MapLibreGL.MapView>
      ) : (
        <View style={[StyleSheet.absoluteFillObject, st.webMapFallback]}>
          <View style={st.webMapContent}>
            <View style={st.webMapGrid}>
              {Array.from({ length: 8 }).map((_, i) => (
                <View key={`h-${i}`} style={[st.webGridH, { top: `${(i + 1) * 11}%` }]} />
              ))}
              {Array.from({ length: 8 }).map((_, i) => (
                <View key={`v-${i}`} style={[st.webGridV, { left: `${(i + 1) * 11}%` }]} />
              ))}
            </View>
            <View style={[st.webStopPin, { top: "25%", right: "20%" }]}>
              <View style={st.webStopPinInner}>
                <MapPin size={16} color={Colors.white} />
              </View>
              <Text style={st.webPinLabel}>{stopName}</Text>
            </View>
            <View style={[st.webBusPin, { bottom: `${25 + progress * 30}%`, left: `${20 + progress * 30}%` }]}>
              <Animated.View style={[st.webBusPulse, { transform: [{ scale: pulseAnim }] }]} />
              <View style={st.webBusPinInner}>
                <Bus size={16} color={Colors.white} />
              </View>
              <Text style={st.webPinLabel}>{busReg}</Text>
            </View>
            <View style={st.webRouteLine} />
            <View style={st.webLiveBadge}>
              <Radio size={12} color={Colors.white} />
              <Text style={st.webLiveTxt}>LIVE TRACKING</Text>
            </View>
          </View>
        </View>
      )}

      <View style={st.topBar}>
        <TouchableOpacity style={st.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={st.backBtnTxt}>←</Text>
        </TouchableOpacity>
        <View style={st.liveBadge}>
          <Animated.View style={[st.liveDotOuter, { opacity: liveDot }]}>
            <View style={st.liveDotInner} />
          </Animated.View>
          <Text style={st.liveTxt}>LIVE</Text>
        </View>
        <TouchableOpacity style={st.recenterBtn} onPress={recenterMap} activeOpacity={0.8}>
          <Navigation size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <Animated.View style={[st.bottomSheet, { transform: [{ translateY: sheetTranslate }] }]}>
        <TouchableOpacity style={st.sheetHandle} onPress={toggleExpand} activeOpacity={0.8}>
          <View style={st.handleBar} />
        </TouchableOpacity>

        <View style={st.etaSection}>
          <View style={st.etaLeft}>
            <Text style={st.etaLabel}>Arriving in</Text>
            <View style={st.etaRow}>
              <Text style={[st.etaNum, { color: etaColor }]}>{displayedEta}</Text>
              <Text style={[st.etaUnit, { color: etaColor }]}>min</Text>
            </View>
          </View>
          <View style={st.etaRight}>
            <View style={st.progressCircleOuter}>
              <View style={[st.progressCircleFill, { height: `${Math.min(100, progress * 100)}%` }]} />
              <Bus size={20} color={Colors.white} />
            </View>
          </View>
        </View>

        <View style={st.progressBarWrap}>
          <View style={st.progressBarBg}>
            <View style={[st.progressBarFill, { width: `${Math.min(100, progress * 100)}%` }]} />
          </View>
          <View style={st.progressLabels}>
            <Text style={st.progressLabelLeft} numberOfLines={1}>{busReg}</Text>
            <Text style={st.progressLabelRight} numberOfLines={1}>{stopName}</Text>
          </View>
        </View>

        {expanded && (
          <View style={st.detailsSection}>
            <View style={st.busCardCompact}>
              <View style={st.busCardIcon}>
                <Bus size={20} color={Colors.primary} />
              </View>
              <View style={st.busCardInfo}>
                <Text style={st.busCardName} numberOfLines={1}>{driverName}</Text>
                <Text style={st.busCardReg} numberOfLines={1}>{busReg}</Text>
              </View>
              <View style={[st.seatsBadge, { backgroundColor: seats > 5 ? Colors.successLight : Colors.warningLight }]}>
                <Users size={12} color={seats > 5 ? Colors.success : Colors.warning} />
                <Text style={[st.seatsTxt, { color: seats > 5 ? Colors.success : Colors.warning }]}>{seats}</Text>
              </View>
            </View>

            <View style={st.infoGrid}>
              <View style={st.infoItem}>
                <MapPin size={14} color={Colors.gray400} />
                <View style={st.infoItemText}>
                  <Text style={st.infoLabel} numberOfLines={1}>Route</Text>
                  <Text style={st.infoValue} numberOfLines={2}>{routeName}</Text>
                </View>
              </View>
              <View style={st.infoItem}>
                <MapPin size={14} color={Colors.primary} />
                <View style={st.infoItemText}>
                  <Text style={st.infoLabel} numberOfLines={1}>Heading to</Text>
                  <Text style={st.infoValue} numberOfLines={2}>{stopName}</Text>
                </View>
              </View>
            </View>

            <View style={st.warningRow}>
              <AlertTriangle size={13} color={Colors.warning} />
              <Text style={st.warningTxt}>Bus will not wait at the stop. Be there before arrival.</Text>
            </View>

            <View style={st.routingRow}>
              <Navigation size={13} color={Colors.primary} />
              <Text style={st.routingTxt} numberOfLines={2}>
                {directions.isError
                  ? "Road route unavailable — showing a direct estimate."
                  : nextInstruction}
              </Text>
            </View>

            <View style={st.updateRow}>
              <Clock size={11} color={Colors.gray400} />
              <Text style={st.updateTxt}>Last updated: {lastUpdate}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity style={st.expandToggle} onPress={toggleExpand} activeOpacity={0.7}>
          {expanded ? (
            <ChevronDown size={18} color={Colors.gray400} />
          ) : (
            <ChevronUp size={18} color={Colors.gray400} />
          )}
          <Text style={st.expandTxt}>{expanded ? "Show less" : "Show details"}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },

  webMapFallback: { backgroundColor: "#E8F0E8" },
  webMapContent: { flex: 1, position: "relative" as const, overflow: "hidden" as const },
  webMapGrid: { ...StyleSheet.absoluteFillObject },
  webGridH: { position: "absolute" as const, left: 0, right: 0, height: 1, backgroundColor: "rgba(46,125,50,0.06)" },
  webGridV: { position: "absolute" as const, top: 0, bottom: 0, width: 1, backgroundColor: "rgba(46,125,50,0.06)" },
  webStopPin: { position: "absolute" as const, alignItems: "center" as const },
  webStopPinInner: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 3, borderColor: Colors.white },
  webBusPin: { position: "absolute" as const, alignItems: "center" as const },
  webBusPulse: { position: "absolute" as const, width: 50, height: 50, borderRadius: 25, backgroundColor: "rgba(232,93,4,0.15)" },
  webBusPinInner: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 3, borderColor: Colors.white, zIndex: 2 },
  webPinLabel: { fontSize: 10, fontWeight: "700" as const, color: Colors.gray700, marginTop: 4, backgroundColor: "rgba(255,255,255,0.9)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  webRouteLine: { position: "absolute" as const, top: "40%", left: "25%", width: "50%", height: 3, backgroundColor: Colors.primary, borderRadius: 2, transform: [{ rotate: "-30deg" }] },
  webLiveBadge: { position: "absolute" as const, top: 80, left: 16, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.danger, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  webLiveTxt: { fontSize: 11, fontWeight: "800" as const, color: Colors.white, letterSpacing: 1 },

  topBar: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: Platform.OS === "ios" ? 54 : 40,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  backBtnTxt: { fontSize: 20, color: Colors.gray800, fontWeight: "600" as const },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  liveDotOuter: { width: 12, height: 12, borderRadius: 6, backgroundColor: "rgba(220,38,38,0.2)", alignItems: "center" as const, justifyContent: "center" as const },
  liveDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger },
  liveTxt: { fontSize: 12, fontWeight: "800" as const, color: Colors.danger, letterSpacing: 1 },
  recenterBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.white,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },

  stopMarker: { alignItems: "center" as const },
  stopMarkerInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.secondary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  stopMarkerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: Colors.secondary,
    marginTop: -2,
  },

  busMarkerWrap: { alignItems: "center" as const, justifyContent: "center" as const, width: 56, height: 56 },
  busMarkerPulse: {
    position: "absolute" as const,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(232,93,4,0.18)",
  },
  busMarkerCore: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },

  bottomSheet: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
  sheetHandle: { alignItems: "center" as const, paddingVertical: 12 },
  handleBar: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.gray200 },

  etaSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  etaLeft: {},
  etaLabel: { fontSize: 13, color: Colors.gray500, fontWeight: "500" as const },
  etaRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: 2 },
  etaNum: { fontSize: 42, fontWeight: "900" as const, lineHeight: 46 },
  etaUnit: { fontSize: 18, fontWeight: "700" as const, marginBottom: 4 },
  etaRight: {},
  progressCircleOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryFaded,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
  },
  progressCircleFill: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.primary,
  },

  progressBarWrap: { marginBottom: 14 },
  progressBarBg: {
    height: 6,
    backgroundColor: Colors.gray100,
    borderRadius: 3,
    overflow: "hidden" as const,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  progressLabelLeft: { fontSize: 11, color: Colors.gray400, fontWeight: "600" as const, flex: 1, marginRight: 8 },
  progressLabelRight: { fontSize: 11, color: Colors.primary, fontWeight: "700" as const, flex: 1, textAlign: "right" as const },

  detailsSection: { gap: 12 },
  busCardCompact: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.screenBg,
    borderRadius: 14,
    padding: 12,
  },
  busCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: Colors.primaryFaded,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  busCardInfo: { flex: 1, marginLeft: 12 },
  busCardName: { fontSize: 15, fontWeight: "700" as const, color: Colors.gray800 },
  busCardReg: { fontSize: 12, color: Colors.gray400, marginTop: 1 },
  seatsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  seatsTxt: { fontSize: 14, fontWeight: "800" as const },

  infoGrid: { flexDirection: "row", gap: 10 },
  infoItem: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: Colors.screenBg,
    borderRadius: 12,
    padding: 10,
  },
  infoItemText: { flex: 1, minWidth: 0 },
  infoLabel: { fontSize: 10, color: Colors.gray400, textTransform: "uppercase" as const, letterSpacing: 0.3 },
  infoValue: { fontSize: 13, fontWeight: "600" as const, color: Colors.gray800, marginTop: 1 },

  warningRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.warningLight,
    padding: 10,
    borderRadius: 10,
  },
  warningTxt: { fontSize: 11, color: Colors.warning, fontWeight: "500" as const, flex: 1, lineHeight: 16 },
  routingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primaryFaded,
    padding: 10,
    borderRadius: 10,
  },
  routingTxt: { fontSize: 11, color: Colors.primary, fontWeight: "600" as const, flex: 1, lineHeight: 16 },

  updateRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  updateTxt: { fontSize: 10, color: Colors.gray400, fontStyle: "italic" as const },

  expandToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 10,
    marginTop: 4,
  },
  expandTxt: { fontSize: 12, color: Colors.gray400, fontWeight: "500" as const },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
