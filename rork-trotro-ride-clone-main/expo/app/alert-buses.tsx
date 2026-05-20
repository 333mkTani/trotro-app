import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Stack } from "expo-router";
import {
  Bus,
  Users,
  Clock,
  MapPin,
  CheckCircle,
  AlertTriangle,
  Navigation,
  Route,
  ChevronRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useBusAlerts } from "@/contexts/BusAlertContext";
import { ApproachingBus } from "@/types";
const Colors = StaticColors;

export default function AlertBusesScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const { alertId } = useLocalSearchParams<{ alertId: string }>();
  const { alerts } = useBusAlerts();

  const alert = useMemo(
    () => alerts.find((a) => a.id === alertId),
    [alerts, alertId],
  );

  const buses = useMemo(
    () => alert?.triggered_buses?.filter((b) => b.seats_available > 0) ?? [],
    [alert],
  );

  const [bookingBusId, setBookingBusId] = useState<string | null>(null);
  const [bookedBus, setBookedBus] = useState<ApproachingBus | null>(null);
  const fadeIn = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const onBook = useCallback(
    async (bus: ApproachingBus) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setBookingBusId(bus.driver_id);
      await new Promise((r) => setTimeout(r, 1500));
      setBookingBusId(null);
      setBookedBus(bus);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
    },
    [successScale],
  );

  const stopData = useMemo(() => {
    if (!alert) return null;
    const allStops = require('@/mocks/stops').ALL_BUS_STOPS;
    return allStops.find((s: { id: string }) => s.id === alert.stop_id) ?? null;
  }, [alert]);

  const onTrack = useCallback(
    (bus: ApproachingBus) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      router.push({
        pathname: "/tracking",
        params: {
          driverId: bus.driver_id,
          driverName: bus.driver_name,
          busReg: bus.bus_registration,
          routeName: bus.route_name,
          seats: String(bus.seats_available),
          eta: String(bus.eta_minutes),
          lat: String(bus.lat),
          lng: String(bus.lng),
          stopLat: String(stopData?.lat ?? bus.lat),
          stopLng: String(stopData?.lng ?? bus.lng),
          stopName: alert?.stop_name ?? "Bus Stop",
        },
      });
    },
    [router, stopData, alert],
  );

  if (!alert) {
    return (
      <View style={st.root}>
        <Stack.Screen options={{ title: "Alert Details" }} />
        <View style={st.emptyWrap}>
          <AlertTriangle size={40} color={Colors.gray300} />
          <Text style={st.emptyTitle}>Alert not found</Text>
          <TouchableOpacity style={st.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={st.backBtnTxt}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (bookedBus) {
    return (
      <View style={st.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={st.successWrap}>
          <Animated.View style={[st.successCard, { transform: [{ scale: successScale }] }]}>
            <View style={st.successIconWrap}>
              <CheckCircle size={48} color={Colors.white} />
            </View>
            <Text style={st.successTitle}>Seat Booked!</Text>
            <Text style={st.successSub}>
              Your seat has been reserved. Head to {alert.stop_name} now — the bus will not wait.
            </Text>
            <View style={st.successDetails}>
              <DetailRow label="Bus Stop" value={alert.stop_name} />
              <DetailRow label="Route" value={bookedBus.route_name} />
              <DetailRow label="Driver" value={bookedBus.driver_name} />
              <DetailRow label="Bus" value={bookedBus.bus_registration} />
              <DetailRow label="ETA" value={`~${bookedBus.eta_minutes} min`} />
              <DetailRow label="Seats left" value={`${bookedBus.seats_available}`} />
            </View>
            <View style={st.warningBox}>
              <AlertTriangle size={14} color={Colors.warning} />
              <Text style={st.warningTxt}>
                Buses will not wait for you at the stop. Please arrive before the bus does.
              </Text>
            </View>
            <Text style={st.disclaimer}>Estimated arrival based on traffic conditions</Text>
            <TouchableOpacity
              style={st.primaryBtn}
              onPress={() => router.push("/(tabs)/rides")}
              activeOpacity={0.7}
            >
              <Text style={st.primaryBtnTxt}>View My Rides</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.secBtn}
              onPress={() => router.back()}
              activeOpacity={0.6}
            >
              <Text style={st.secBtnTxt}>Back to Home</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <Stack.Screen
        options={{
          title: "Available Buses",
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.gray800, fontWeight: "700" as const },
          headerTintColor: Colors.primary,
        }}
      />
      <Animated.View style={[st.flex, { opacity: fadeIn }]}>
        <ScrollView
          style={st.flex}
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={st.alertInfoCard}>
            <View style={st.alertInfoHead}>
              <View style={st.alertDot} />
              <Text style={st.alertInfoTitle}>Alert Triggered</Text>
            </View>
            <View style={st.alertInfoRow}>
              <MapPin size={14} color={Colors.primary} />
              <Text style={st.alertInfoVal} numberOfLines={2}>{alert.stop_name}</Text>
            </View>
            <View style={st.alertInfoRow}>
              <Route size={14} color={Colors.secondary} />
              <Text style={st.alertInfoVal} numberOfLines={2}>{alert.route_name}</Text>
            </View>
          </View>

          <View style={st.warningBanner}>
            <AlertTriangle size={14} color={Colors.warning} />
            <Text style={st.warningBannerTxt}>
              Buses will not wait at the stop. Be there before the bus arrives.
            </Text>
          </View>

          {buses.length === 0 ? (
            <View style={st.noBusesWrap}>
              <Bus size={40} color={Colors.gray300} />
              <Text style={st.noBusesTitle}>No Buses Available</Text>
              <Text style={st.noBusesSub}>
                No buses with available seats are approaching {alert.stop_name} right now.
              </Text>
              <TouchableOpacity
                style={st.backBtn}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Text style={st.backBtnTxt}>Go Back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={st.sectionLabel}>
                {buses.length} BUS{buses.length > 1 ? "ES" : ""} WITH AVAILABLE SEATS
              </Text>
              {buses.map((bus, idx) => (
                <BusCard
                  key={bus.driver_id}
                  bus={bus}
                  index={idx}
                  isBooking={bookingBusId === bus.driver_id}
                  anyBooking={bookingBusId !== null}
                  onBook={() => onBook(bus)}
                  onTrack={() => onTrack(bus)}
                />
              ))}
              <Text style={st.globalDisclaimer}>
                Estimated arrival based on traffic conditions
              </Text>
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const BusCard = React.memo(function BusCard({
  bus,
  index,
  isBooking,
  anyBooking,
  onBook,
  onTrack,
}: {
  bus: ApproachingBus;
  index: number;
  isBooking: boolean;
  anyBooking: boolean;
  onBook: () => void;
  onTrack: () => void;
}) {
  return (
    <View style={st.busCard}>
      {index === 0 && (
        <View style={st.bestBadge}>
          <Text style={st.bestBadgeTxt}>SOONEST ARRIVAL</Text>
        </View>
      )}
      <View style={st.busTop}>
        <View style={st.busIcon}>
          <Bus size={20} color={Colors.primary} />
        </View>
        <View style={st.busInfo}>
          <Text style={st.busDriver} numberOfLines={1}>{bus.driver_name}</Text>
          <Text style={st.busReg} numberOfLines={1}>{bus.bus_registration}</Text>
        </View>
        <View style={st.etaPill}>
          <Clock size={11} color={Colors.white} />
          <Text style={st.etaPillTxt}>~{bus.eta_minutes} min</Text>
        </View>
      </View>

      <View style={st.busMeta}>
        <View style={st.busMetaItem}>
          <Route size={13} color={Colors.secondary} />
          <Text style={st.busMetaTxt} numberOfLines={1}>{bus.route_name}</Text>
        </View>
        <View style={st.busMetaDivider} />
        <View style={st.busMetaItem}>
          <Users size={13} color={Colors.success} />
          <Text style={[st.busMetaTxt, { color: Colors.success }]} numberOfLines={1}>
            {bus.seats_available} seat{bus.seats_available > 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      <View style={st.busActions}>
        <TouchableOpacity
          style={[st.bookBtn, (isBooking || anyBooking) && st.bookBtnOff]}
          onPress={onBook}
          activeOpacity={0.8}
          disabled={anyBooking}
        >
          {isBooking ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={st.bookBtnTxt}>Book Seat</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={st.trackBtn} onPress={onTrack} activeOpacity={0.7}>
          <Navigation size={14} color={Colors.primary} />
          <Text style={st.trackBtnTxt}>Track</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const DetailRow = React.memo(function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={st.detailRow}>
      <Text style={st.detailLabel}>{label}</Text>
      <Text style={st.detailValue}>{value}</Text>
    </View>
  );
});



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  flex: { flex: 1 },
  scroll: { padding: 16 },
  alertInfoCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  alertInfoHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  alertDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.success },
  alertInfoTitle: { fontSize: 16, fontWeight: "700" as const, color: Colors.gray800 },
  alertInfoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  alertInfoVal: { fontSize: 14, fontWeight: "500" as const, color: Colors.gray700, flex: 1 },
  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.warningLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  warningBannerTxt: { fontSize: 12, color: Colors.warning, fontWeight: "500" as const, flex: 1, lineHeight: 17 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gray400,
    letterSpacing: 1,
    marginBottom: 12,
  },
  busCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden" as const,
  },
  bestBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: "flex-start" as const,
    borderBottomRightRadius: 10,
  },
  bestBadgeTxt: { fontSize: 10, fontWeight: "800" as const, color: Colors.white, letterSpacing: 0.5 },
  busTop: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 10,
  },
  busIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primaryFaded,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  busInfo: { flex: 1, minWidth: 0, marginLeft: 12 },
  busDriver: { fontSize: 16, fontWeight: "700" as const, color: Colors.gray800 },
  busReg: { fontSize: 12, color: Colors.gray400, marginTop: 2 },
  etaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  etaPillTxt: { fontSize: 13, fontWeight: "700" as const, color: Colors.white },
  busMeta: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
  },
  busMetaItem: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1, minWidth: 0 },
  busMetaTxt: { fontSize: 12, color: Colors.gray500, fontWeight: "500" as const },
  busMetaDivider: { width: 1, height: 14, backgroundColor: Colors.gray200 },
  busActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  bookBtn: {
    flex: 2,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 14,
    backgroundColor: Colors.primary,
  },
  bookBtnOff: { opacity: 0.5 },
  bookBtnTxt: { fontSize: 14, fontWeight: "700" as const, color: Colors.white },
  trackBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    backgroundColor: Colors.primaryFaded,
  },
  trackBtnTxt: { fontSize: 13, fontWeight: "600" as const, color: Colors.primary },
  globalDisclaimer: {
    fontSize: 10,
    color: Colors.gray400,
    fontStyle: "italic" as const,
    textAlign: "center" as const,
    marginTop: 8,
  },
  noBusesWrap: { alignItems: "center" as const, paddingTop: 50, gap: 10 },
  noBusesTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.gray700 },
  noBusesSub: { fontSize: 14, color: Colors.gray400, textAlign: "center" as const, paddingHorizontal: 20 },
  backBtn: {
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  backBtnTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
  emptyWrap: { flex: 1, alignItems: "center" as const, justifyContent: "center" as const, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.gray700 },
  successWrap: { flex: 1, justifyContent: "center" as const, padding: 20, backgroundColor: Colors.screenBg },
  successCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    alignItems: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 16,
  },
  successTitle: { fontSize: 24, fontWeight: "800" as const, color: Colors.gray800, marginBottom: 8 },
  successSub: { fontSize: 14, color: Colors.gray500, textAlign: "center" as const, marginBottom: 20, lineHeight: 20 },
  successDetails: {
    width: "100%" as const,
    backgroundColor: Colors.gray50,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  detailLabel: { fontSize: 13, color: Colors.gray500 },
  detailValue: { fontSize: 13, fontWeight: "600" as const, color: Colors.gray800, flex: 1, textAlign: "right" as const },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    width: "100%" as const,
  },
  warningTxt: { fontSize: 12, color: Colors.warning, fontWeight: "500" as const, flex: 1, lineHeight: 17 },
  disclaimer: { fontSize: 10, color: Colors.gray400, fontStyle: "italic" as const, marginBottom: 20 },
  primaryBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    width: "100%" as const,
    alignItems: "center" as const,
  },
  primaryBtnTxt: { fontSize: 15, fontWeight: "700" as const, color: Colors.white },
  secBtn: { paddingVertical: 10, marginTop: 4 },
  secBtnTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.gray500 },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
