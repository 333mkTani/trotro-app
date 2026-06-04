import React, { useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import { MapPin, Check, X, Crosshair } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MapLibreGL from "@maplibre/maplibre-react-native";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useLocation } from "@/contexts/LocationContext";
import { findNearbyStops } from "@/utils/routeFinder";
const Colors = StaticColors;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");



interface PinnedLocation {
  latitude: number;
  longitude: number;
}

export default function PickDestinationMapScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  s = React.useMemo(() => make_s(themeColors), [themeColors]);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mapCenter, regionStops } = useLocation();
  const cameraRef = useRef<React.ComponentRef<typeof MapLibreGL.Camera>>(null);
  const [pin, setPin] = useState<PinnedLocation | null>(null);
  const [nearestStopName, setNearestStopName] = useState<string | null>(null);
  const [nearestStopDistance, setNearestStopDistance] = useState<number>(0);

  const handlePinDrop = useCallback((latitude: number, longitude: number) => {
    console.log("[PickMap] Pin dropped at:", latitude, longitude);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    setPin({ latitude, longitude });

    const nearby = findNearbyStops(latitude, longitude, 10000, regionStops);
    if (nearby.length > 0) {
      setNearestStopName(nearby[0].name);
      setNearestStopDistance(nearby[0].distance_m);
    } else {
      setNearestStopName(null);
      setNearestStopDistance(0);
    }
  }, [regionStops]);

  const onConfirm = useCallback(() => {
    if (!pin) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    console.log("[PickMap] Confirmed pin at:", pin.latitude, pin.longitude);

    router.replace({
      pathname: "/find-route",
      params: {
        pinLat: String(pin.latitude),
        pinLng: String(pin.longitude),
        pinLabel: nearestStopName ?? `${pin.latitude.toFixed(4)}, ${pin.longitude.toFixed(4)}`,
      },
    });
  }, [pin, nearestStopName, router]);

  const onClearPin = useCallback(() => {
    setPin(null);
    setNearestStopName(null);
    setNearestStopDistance(0);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const recenter = useCallback(() => {
    cameraRef.current?.setCamera({
      centerCoordinate: [mapCenter.longitude, mapCenter.latitude],
      zoomLevel: 12,
      animationDuration: 400,
    });
  }, [mapCenter]);

  return (
    <View style={s.root}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {Platform.OS === "web" ? (
        <View style={s.webFallback}>
          <MapPin size={48} color={Colors.primary} />
          <Text style={s.webTitle}>Pick on Map</Text>
          <Text style={s.webSub}>
            Map pin selection is available on mobile devices. Please type your destination instead.
          </Text>
          <TouchableOpacity
            style={s.webBackBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={s.webBackTxt}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <MapLibreGL.MapView
            style={s.map}
            mapStyle="https://tiles.openfreemap.org/styles/liberty"
            logoEnabled={false}
            attributionEnabled={false}
            onPress={(feature) => {
              if (feature.geometry.type === "Point") {
                const [lng, lat] = feature.geometry.coordinates as [number, number];
                handlePinDrop(lat, lng);
              }
            }}
          >
            <MapLibreGL.Camera
              ref={cameraRef}
              centerCoordinate={[mapCenter.longitude, mapCenter.latitude]}
              zoomLevel={12}
              animationDuration={0}
            />
            <MapLibreGL.UserLocation visible />
            {pin && (
              <MapLibreGL.PointAnnotation
                id="destination-pin"
                coordinate={[pin.longitude, pin.latitude]}
                draggable
                onDragEnd={(feature) => {
                  const [lng, lat] = feature.geometry.coordinates as [number, number];
                  handlePinDrop(lat, lng);
                }}
              >
                <View style={s.pinMarker}>
                  <View style={s.pinDot} />
                  <View style={s.pinStem} />
                  <View style={s.pinShadow} />
                </View>
              </MapLibreGL.PointAnnotation>
            )}
          </MapLibreGL.MapView>

          {!pin && (
            <View style={[s.instructionBanner, { top: insets.top + 60 }]} pointerEvents="none">
              <View style={s.instructionCard}>
                <Crosshair size={18} color={Colors.primary} />
                <Text style={s.instructionText}>Tap anywhere on the map to drop a pin</Text>
              </View>
            </View>
          )}

          <View style={[s.topBar, { paddingTop: insets.top + 8 }]}>
            <TouchableOpacity
              style={s.topBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <X size={20} color={Colors.gray700} />
            </TouchableOpacity>
            <Text style={s.topTitle}>Pick Destination</Text>
            <TouchableOpacity
              style={s.topBtn}
              onPress={recenter}
              activeOpacity={0.7}
            >
              <Crosshair size={20} color={Colors.gray700} />
            </TouchableOpacity>
          </View>

          {pin && (
            <View style={[s.bottomSheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
              <View style={s.pinInfoRow}>
                <View style={s.pinInfoIcon}>
                  <MapPin size={20} color={Colors.primary} />
                </View>
                <View style={s.pinInfoText}>
                  <Text style={s.pinInfoTitle} numberOfLines={1}>
                    {nearestStopName
                      ? `Near ${nearestStopName}`
                      : "Custom Location"}
                  </Text>
                  <Text style={s.pinInfoSub}>
                    {nearestStopName
                      ? `${nearestStopDistance < 1000
                          ? `${nearestStopDistance}m`
                          : `${(nearestStopDistance / 1000).toFixed(1)}km`
                        } from nearest stop`
                      : `${pin.latitude.toFixed(4)}, ${pin.longitude.toFixed(4)}`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={s.clearBtn}
                  onPress={onClearPin}
                  activeOpacity={0.7}
                >
                  <X size={16} color={Colors.gray500} />
                </TouchableOpacity>
              </View>

              <Text style={s.dragHint}>Drag the pin to adjust location</Text>

              <TouchableOpacity
                style={s.confirmBtn}
                onPress={onConfirm}
                activeOpacity={0.8}
              >
                <Check size={18} color={Colors.white} />
                <Text style={s.confirmTxt}>Confirm Destination</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );
}



const make_s = (Colors: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.screenBg,
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  topBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.gray800,
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  instructionBanner: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 5,
  },
  instructionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  instructionText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.gray700,
  },
  pinMarker: {
    alignItems: "center",
  },
  pinDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.white,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 2,
  },
  pinStem: {
    width: 3,
    height: 16,
    backgroundColor: Colors.primary,
    marginTop: -2,
    zIndex: 1,
  },
  pinShadow: {
    width: 12,
    height: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.15)",
    marginTop: 2,
  },
  bottomSheet: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 12,
  },
  pinInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  pinInfoIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  pinInfoText: {
    flex: 1,
  },
  pinInfoTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.gray800,
  },
  pinInfoSub: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  clearBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.gray100,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHint: {
    fontSize: 12,
    color: Colors.gray400,
    fontStyle: "italic" as const,
    textAlign: "center" as const,
    marginBottom: 14,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  confirmTxt: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  webTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.gray700,
  },
  webSub: {
    fontSize: 14,
    color: Colors.gray500,
    textAlign: "center" as const,
    lineHeight: 20,
  },
  webBackBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  webBackTxt: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.white,
  },
});

let s: ReturnType<typeof make_s> = make_s(StaticColors as unknown as ThemePalette);
