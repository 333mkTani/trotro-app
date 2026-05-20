import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Animated,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { MapPin, CheckCircle, X, Bus, Wallet } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useBookings } from "@/contexts/BookingContext";
import { useAuth } from "@/contexts/AuthContext";
import { Booking } from "@/types";
const Colors = StaticColors;

const CHECK_INTERVAL = 10_000;
const DISMISS_DURATION = 5 * 60 * 1000;

export default function ArrivalNotificationBanner() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const { bookings } = useBookings();
  const { user } = useAuth();
  const router = useRouter();
  const [arrivedBooking, setArrivedBooking] = useState<Booking | null>(null);
  const [ending, setEnding] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Record<string, number>>({});
  const slideAnim = useRef(new Animated.Value(-200)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const shown = useRef(false);

  const checkArrivals = useCallback(() => {
    const now = Date.now();
    const cleanDismissed = { ...dismissedIds };
    let changed = false;
    for (const [id, ts] of Object.entries(cleanDismissed)) {
      if (now - ts > DISMISS_DURATION) {
        delete cleanDismissed[id];
        changed = true;
      }
    }
    if (changed) setDismissedIds(cleanDismissed);

    const myConfirmed = bookings.filter(
      (b) =>
        b.status === "confirmed" &&
        (b.passenger_id === user?.id || b.passenger_id === "pass-1") &&
        !cleanDismissed[b.id]
    );

    const arrived = myConfirmed.find((b) => {
      const arrivalTime = new Date(b.desired_arrival_time).getTime();
      return now >= arrivalTime;
    });

    if (arrived && (!arrivedBooking || arrived.id !== arrivedBooking.id)) {
      setArrivedBooking(arrived);
      console.log("[ArrivalNotification] Passenger arrived at destination:", arrived.destination_stop_name);
    } else if (!arrived && arrivedBooking) {
      hideAndClear();
    }
  }, [bookings, user?.id, dismissedIds, arrivedBooking]);

  useEffect(() => {
    checkArrivals();
    const interval = setInterval(checkArrivals, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [checkArrivals]);

  useEffect(() => {
    if (arrivedBooking && !shown.current) {
      shown.current = true;
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 10,
      }).start();

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [arrivedBooking]);

  const hideAndClear = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -200,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      shown.current = false;
      setArrivedBooking(null);
    });
  }, [slideAnim]);

  const handleEndRide = useCallback(() => {
    if (!arrivedBooking) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    router.push({
      pathname: "/pay-driver",
      params: {
        bookingId: arrivedBooking.id,
        driverName: arrivedBooking.driver_name ?? "",
        busReg: arrivedBooking.bus_registration ?? "",
        routeName: arrivedBooking.route_name ?? "",
        pickupStop: arrivedBooking.pickup_stop_name,
        destinationStop: arrivedBooking.destination_stop_name,
        suggestedFare: "3",
      },
    });
    hideAndClear();
  }, [arrivedBooking, router, hideAndClear]);

  const handleDismiss = useCallback(() => {
    if (!arrivedBooking) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissedIds((prev) => ({ ...prev, [arrivedBooking.id]: Date.now() }));
    hideAndClear();
  }, [arrivedBooking, hideAndClear]);

  if (!arrivedBooking) return null;

  return (
    <Animated.View
      style={[
        st.container,
        { transform: [{ translateY: slideAnim }] },
      ]}
      pointerEvents="box-none"
    >
      <Animated.View style={[st.card, { transform: [{ scale: pulseAnim }] }]}>
        <TouchableOpacity style={st.dismissBtn} onPress={handleDismiss} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <X size={16} color={Colors.gray400} />
        </TouchableOpacity>

        <View style={st.iconRow}>
          <View style={st.arriveIcon}>
            <MapPin size={22} color={Colors.white} />
          </View>
          <View style={st.textCol}>
            <Text style={st.title}>You've arrived!</Text>
            <View style={st.routeRow}>
              <Bus size={12} color={Colors.gray500} />
              <Text style={st.routeText} numberOfLines={1}>
                {arrivedBooking.pickup_stop_name} → {arrivedBooking.destination_stop_name}
              </Text>
            </View>
          </View>
        </View>

        <Text style={st.desc}>
          Please confirm you've reached your destination to free up your seat for other passengers.
        </Text>

        <TouchableOpacity
          style={st.endBtn}
          onPress={handleEndRide}
          activeOpacity={0.8}
          testID="arrival-end-ride"
        >
          <Wallet size={18} color={Colors.white} />
          <Text style={st.endBtnText}>Pay Driver & End Ride</Text>
        </TouchableOpacity>

        <Text style={st.reminder}>Tap dismiss to be reminded again in 5 min</Text>
      </Animated.View>
    </Animated.View>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  container: {
    position: "absolute" as const,
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === "web" ? 12 : 0,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 10,
    borderWidth: 1.5,
    borderColor: Colors.success + "40",
  },
  dismissBtn: {
    position: "absolute" as const,
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gray100,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    zIndex: 10,
  },
  iconRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    marginBottom: 10,
    paddingRight: 32,
  },
  arriveIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: Colors.success,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: "800" as const,
    color: Colors.gray800,
    marginBottom: 3,
  },
  routeRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 5,
  },
  routeText: {
    fontSize: 13,
    color: Colors.gray500,
    fontWeight: "500" as const,
    flex: 1,
  },
  desc: {
    fontSize: 13,
    color: Colors.gray600,
    lineHeight: 19,
    marginBottom: 14,
  },
  endBtn: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    backgroundColor: Colors.success,
    paddingVertical: 14,
    borderRadius: 14,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  endBtnDisabled: {
    backgroundColor: Colors.gray300,
    shadowOpacity: 0,
  },
  endBtnText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  reminder: {
    fontSize: 11,
    color: Colors.gray400,
    textAlign: "center" as const,
    marginTop: 8,
    fontStyle: "italic" as const,
  },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
