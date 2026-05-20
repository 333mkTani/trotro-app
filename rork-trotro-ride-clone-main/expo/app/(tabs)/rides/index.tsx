import React, { useState, useMemo, useCallback, memo } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, RefreshControl, Alert, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Filter } from "lucide-react-native";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { MOCK_VERIFICATION_CODES } from "@/mocks/data";
import { BookingStatus } from "@/types";
import BookingCard from "@/components/BookingCard";
import { useBookings } from "@/contexts/BookingContext";
const Colors = StaticColors;

const FILTERS: { label: string; value: BookingStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

export default function RidesScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const { user } = useAuth();
  const { bookings: allBookings } = useBookings();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [endingId, setEndingId] = useState<string | null>(null);

  const bookings = useMemo(() => {
    const mine = allBookings.filter((b) => b.passenger_id === user?.id || b.passenger_id === "pass-1");
    return filter === "all" ? mine : mine.filter((b) => b.status === filter);
  }, [user?.id, filter, allBookings]);

  const refresh = useCallback(async () => { setRefreshing(true); await new Promise((r) => setTimeout(r, 1000)); setRefreshing(false); }, []);

  const onBookingPress = useCallback((id: string) => {
    const booking = allBookings.find((b) => b.id === id);
    if (booking && booking.verification_code) {
      router.push({
        pathname: "/verification",
        params: {
          code: booking.verification_code,
          bookingId: booking.id,
          validUntil: booking.code_valid_until ?? new Date(Date.now() + 86400000).toISOString(),
          routeName: booking.route_name ?? "",
          pickupStop: booking.pickup_stop_name,
          destinationStop: booking.destination_stop_name,
        },
      });
      return;
    }
    const code = MOCK_VERIFICATION_CODES.find((c) => c.booking_id === id);
    if (code) router.push({ pathname: "/verification", params: { code: code.code, bookingId: code.booking_id, validUntil: code.valid_until, routeName: code.route_name ?? "", pickupStop: code.pickup_stop ?? "", destinationStop: code.destination_stop ?? "" } });
  }, [router, allBookings]);

  const onNavigate = useCallback((booking: typeof MOCK_BOOKINGS[0]) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/navigate-to-pickup",
      params: {
        stopId: booking.pickup_stop_id,
        stopName: booking.pickup_stop_name,
        bookingId: booking.id,
        busReg: booking.bus_registration ?? "",
        driverName: booking.driver_name ?? "",
        routeName: booking.route_name ?? "",
        eta: "10",
      },
    });
  }, [router]);

  const onEndRide = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const booking = allBookings.find((b) => b.id === id);
    if (!booking) return;

    Alert.alert(
      "End Ride",
      "Have you arrived at your destination?",
      [
        { text: "Not Yet", style: "cancel" },
        {
          text: "Yes, Pay & End Ride",
          style: "default",
          onPress: () => {
            router.push({
              pathname: "/pay-driver",
              params: {
                bookingId: booking.id,
                driverName: booking.driver_name ?? "",
                busReg: booking.bus_registration ?? "",
                routeName: booking.route_name ?? "",
                pickupStop: booking.pickup_stop_name,
                destinationStop: booking.destination_stop_name,
                suggestedFare: String(booking.ride_fare ?? 3),
              },
            });
          },
        },
      ],
    );
  }, [allBookings, router]);

  const onCancel = useCallback((id: string) => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert("Cancel Ride", "Cancel this scheduled ride?", [{ text: "Keep", style: "cancel" }, { text: "Cancel", style: "destructive", onPress: () => Alert.alert("Cancelled", "Ride cancelled.") }]);
  }, []);

  return (
    <View style={st.root}>
      <View style={st.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.filterScroll}>
          {FILTERS.map((f) => <TouchableOpacity key={f.value} style={[st.filterChip, filter === f.value && st.filterOn]} onPress={() => setFilter(f.value)} activeOpacity={0.7}><Text style={[st.filterTxt, filter === f.value && st.filterTxtOn]}>{f.label}</Text></TouchableOpacity>)}
        </ScrollView>
      </View>
      <ScrollView style={st.list} contentContainerStyle={st.listInner} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} colors={[Colors.primary]} />}>
        {bookings.length === 0 ? (
          <View style={st.empty}><Filter size={48} color={Colors.gray300} /><Text style={st.emptyTitle}>No rides found</Text><Text style={st.emptySub}>{filter === "all" ? "Schedule your first ride!" : `No ${filter} rides.`}</Text>
            {filter === "all" && <TouchableOpacity style={st.schedBtn} onPress={() => router.push("/(tabs)/schedule")} activeOpacity={0.7}><Text style={st.schedTxt}>Schedule a Ride</Text></TouchableOpacity>}
          </View>
        ) : bookings.map((b) => <BookingCard key={b.id} booking={b} onPress={() => onBookingPress(b.id)} onCancel={() => onCancel(b.id)} onNavigate={b.status === "confirmed" ? () => onNavigate(b) : undefined} onEndRide={b.status === "confirmed" ? () => onEndRide(b.id) : undefined} endingRide={endingId === b.id} />)}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  filterRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.gray100 },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.gray200 },
  filterOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterTxt: { fontSize: 13, fontWeight: "600" as const, color: Colors.gray600 },
  filterTxtOn: { color: Colors.white },
  list: { flex: 1 },
  listInner: { paddingTop: 16 },
  empty: { alignItems: "center" as const, paddingTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.gray700, marginTop: 16 },
  emptySub: { fontSize: 14, color: Colors.gray400, textAlign: "center" as const, marginTop: 8 },
  schedBtn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, marginTop: 20 },
  schedTxt: { fontSize: 14, fontWeight: "700" as const, color: Colors.white },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
