import React, { useRef, useEffect, useCallback, memo } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform, Animated, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Bus, Clock, Users, CheckCircle, X, AlarmClock, AlertTriangle } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { MOCK_BOOKINGS } from "@/mocks/data";
const Colors = StaticColors;

export default function RideNotificationScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const nav = useRouter();
  const slide = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const bk = MOCK_BOOKINGS.find((b) => b.status === "confirmed");

  useEffect(() => {
    Animated.parallel([Animated.spring(slide, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }), Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true })]).start();
    const a = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1.08, duration: 800, useNativeDriver: true }), Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true })]));
    a.start(); return () => a.stop();
  }, []);

  const confirm = useCallback(() => {
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Confirmed!", "Check verification code in My Rides.", [{ text: "View Code", onPress: () => { nav.back(); setTimeout(() => nav.push({ pathname: "/verification", params: { code: "HK7M3R", bookingId: bk?.id ?? "", validUntil: new Date(Date.now() + 86400000).toISOString(), routeName: bk?.route_name ?? "", pickupStop: bk?.pickup_stop_name ?? "", destinationStop: bk?.destination_stop_name ?? "" } }), 300); } }]);
  }, [nav, bk]);

  return (
    <ScrollView style={st.root} contentContainerStyle={st.inner} showsVerticalScrollIndicator={false}>
      <View style={st.banner}><AlertTriangle size={14} color={Colors.warning} /><Text style={st.bannerTxt}>Estimated arrival based on traffic conditions</Text></View>
      <Animated.View style={[st.alertCard, { opacity, transform: [{ translateY: slide }] }]}>
        <View style={st.alertHead}><Animated.View style={[st.alertIc, { transform: [{ scale: pulse }] }]}><Bus size={28} color={Colors.white} /></Animated.View><View style={st.alertInfo}><Text style={st.alertTitle}>Your bus is approaching!</Text><Text style={st.alertSub}>{bk?.route_name ?? "Circle - Madina"}</Text></View></View>
        <View style={st.alertDiv} />
        <View style={st.busDetails}>
          <View style={st.bRow}><Bus size={16} color={Colors.gray500} /><Text style={st.bLabel}>Registration</Text><Text style={st.bVal}>{bk?.bus_registration ?? "GR-1234-20"}</Text></View>
          <View style={st.bRow}><Clock size={16} color={Colors.gray500} /><Text style={st.bLabel}>ETA</Text><Text style={st.bValHL}>~4 minutes</Text></View>
        </View>
        <View style={st.stopBox}><Text style={st.stopLbl}>PICKUP STOP</Text><Text style={st.stopName}>{bk?.pickup_stop_name ?? "Circle"}</Text></View>
        <View style={st.noWaitBox}><AlertTriangle size={13} color={Colors.danger} /><Text style={st.noWaitTxt}>Buses will not wait for you at the stop. Please arrive before the bus does.</Text></View>
      </Animated.View>
      <View style={st.actions}>
        <Animated.View style={{ transform: [{ scale: pulse }] }}><TouchableOpacity style={st.confirmBtn} onPress={confirm} activeOpacity={0.8}><CheckCircle size={20} color={Colors.white} /><Text style={st.confirmTxt}>Confirm Ride</Text></TouchableOpacity></Animated.View>
        <View style={st.secActions}>
          <TouchableOpacity style={st.skipBtn} onPress={() => Alert.alert("Skip", "Bus continues without you.", [{ text: "Keep" }, { text: "Skip", style: "destructive", onPress: () => nav.back() }])} activeOpacity={0.7}><X size={16} color={Colors.danger} /><Text style={st.skipTxt}>Skip</Text></TouchableOpacity>
          <TouchableOpacity style={st.snoozeBtn} onPress={() => { if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); Alert.alert("Snoozed", "We'll notify you in 10 min."); nav.back(); }} activeOpacity={0.7}><AlarmClock size={16} color={Colors.warning} /><Text style={st.snoozeTxt}>Snooze 10 min</Text></TouchableOpacity>
        </View>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primaryFaded },
  inner: { padding: 16 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.warningLight, padding: 12, borderRadius: 12, marginBottom: 16 },
  bannerTxt: { fontSize: 12, color: Colors.warning, fontWeight: "500" as const, flex: 1, fontStyle: "italic" as const },
  alertCard: { backgroundColor: Colors.white, borderRadius: 24, padding: 22, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 6 },
  alertHead: { flexDirection: "row", alignItems: "center", gap: 14 },
  alertIc: { width: 56, height: 56, borderRadius: 18, backgroundColor: Colors.primary, alignItems: "center" as const, justifyContent: "center" as const },
  alertInfo: { flex: 1 },
  alertTitle: { fontSize: 18, fontWeight: "800" as const, color: Colors.gray800 },
  alertSub: { fontSize: 14, color: Colors.gray500, marginTop: 2 },
  alertDiv: { height: 1, backgroundColor: Colors.gray100, marginVertical: 18 },
  busDetails: { gap: 12, marginBottom: 16 },
  bRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  bLabel: { flex: 1, fontSize: 13, color: Colors.gray500 },
  bVal: { fontSize: 14, fontWeight: "600" as const, color: Colors.gray800 },
  bValHL: { fontSize: 14, fontWeight: "700" as const, color: Colors.primary },
  stopBox: { backgroundColor: Colors.primaryFaded, borderRadius: 14, padding: 14 },
  stopLbl: { fontSize: 10, color: Colors.gray400, letterSpacing: 1, marginBottom: 4 },
  stopName: { fontSize: 17, fontWeight: "700" as const, color: Colors.gray800 },
  noWaitBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.dangerLight, borderRadius: 12, padding: 12, marginTop: 14 },
  noWaitTxt: { fontSize: 12, color: Colors.danger, fontWeight: "500" as const, flex: 1, lineHeight: 17 },
  actions: { gap: 12 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.success, paddingVertical: 18, borderRadius: 16, shadowColor: Colors.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  confirmTxt: { fontSize: 17, fontWeight: "800" as const, color: Colors.white },
  secActions: { flexDirection: "row", gap: 12 },
  skipBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.dangerLight, paddingVertical: 14, borderRadius: 14 },
  skipTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.danger },
  snoozeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: Colors.warningLight, paddingVertical: 14, borderRadius: 14 },
  snoozeTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.warning },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
