import React, { useState, useEffect, useRef, memo } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform, Animated, Dimensions, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Shield, Clock, MapPin, ArrowRight, Copy, Navigation, AlertTriangle, QrCode } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import QRCode from "@/components/QRCode";
const Colors = StaticColors;

const VW = Dimensions.get("window").width;
const CW = (VW - 32 - 56 - 40) / 6;

type VP = { code: string; bookingId: string; validUntil: string; routeName: string; pickupStop: string; destinationStop: string };

export default function VerificationScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const p = useLocalSearchParams<VP>();
  const code = p.code || "HK7M3R";
  const until = p.validUntil ? new Date(p.validUntil) : new Date(Date.now() + 86400000);
  const [remaining, setRemaining] = useState("");
  const cScale = useRef(new Animated.Value(0.9)).current;
  const cOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([Animated.spring(cScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }), Animated.timing(cOpacity, { toValue: 1, duration: 400, useNativeDriver: true })]).start();
    const tick = () => { const d = until.getTime() - Date.now(); if (d <= 0) { setRemaining("Expired"); return; } setRemaining(`${Math.floor(d / 3600000)}h ${Math.floor((d % 3600000) / 60000)}m remaining`); };
    tick(); const iv = setInterval(tick, 60000); return () => clearInterval(iv);
  }, []);

  return (
    <ScrollView style={st.root} contentContainerStyle={st.inner} showsVerticalScrollIndicator={false}>
      <View style={st.badge}><Shield size={16} color={Colors.success} /><Text style={st.badgeTxt}>Boarding Pass</Text></View>
      <Animated.View style={[st.codeCard, { transform: [{ scale: cScale }], opacity: cOpacity }]}>
        <Text style={st.codeLbl}>YOUR VERIFICATION CODE</Text>
        <View style={st.codeRow}>{code.split("").map((c, i) => <View key={i} style={st.cell}><Text style={st.cellTxt}>{c}</Text></View>)}</View>
        <View style={st.qrWrap}>
          <QRCode value={code} size={180} backgroundColor="#FFFFFF" testID="verification-qr" />
          <View style={st.qrBadge}>
            <QrCode size={12} color={Colors.gray500} />
            <Text style={st.qrBadgeTxt}>Scan to verify</Text>
          </View>
        </View>
        <View style={st.timerRow}><Clock size={14} color={remaining === "Expired" ? Colors.danger : Colors.gray500} /><Text style={[st.timerTxt, remaining === "Expired" && { color: Colors.danger }]}>{remaining}</Text></View>
        <TouchableOpacity style={st.copyBtn} onPress={() => { if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); Alert.alert("Copied", `Code ${code} copied.`); }} activeOpacity={0.7}><Copy size={16} color={Colors.primary} /><Text style={st.copyTxt}>Copy Code</Text></TouchableOpacity>
      </Animated.View>
      <View style={st.routeCard}>
        <Text style={st.routeTitle}>Ride Details</Text>
        <View style={st.stops}><View style={st.stopCol}><View style={[st.dot, { backgroundColor: Colors.primary }]} /><Text style={st.stopLbl}>PICKUP</Text><Text style={st.stopName}>{p.pickupStop || "Circle"}</Text></View><ArrowRight size={18} color={Colors.gray300} style={{ marginTop: 16 }} /><View style={[st.stopCol, { alignItems: "flex-end" as const }]}><View style={[st.dot, { backgroundColor: Colors.success }]} /><Text style={st.stopLbl}>DESTINATION</Text><Text style={st.stopName}>{p.destinationStop || "Madina"}</Text></View></View>
        <View style={st.routeDiv} />
        <View style={st.routeInfo}><MapPin size={14} color={Colors.gray400} /><Text style={st.routeInfoTxt}>{p.routeName || "Circle - Madina"}</Text></View>
      </View>
      <View style={st.noWaitBanner}>
        <AlertTriangle size={14} color={Colors.danger} />
        <Text style={st.noWaitTxt}>Buses will not wait for you at the stop upon arrival. Be at the stop before the bus arrives.</Text>
      </View>
      <View style={st.howTo}>
        <Text style={st.howTitle}>How to board</Text>
        {["Arrive at your pickup stop before the bus", "Show this code to the driver", "Driver verifies and confirms your seat"].map((s, i) => <View key={i} style={st.step}><View style={st.stepN}><Text style={st.stepNTxt}>{i + 1}</Text></View><Text style={st.stepTxt}>{s}</Text></View>)}
      </View>
      <TouchableOpacity style={st.navBtn} onPress={() => Alert.alert("Navigate", "Opening Google Maps...")} activeOpacity={0.7}><Navigation size={18} color={Colors.white} /><Text style={st.navTxt}>Navigate to Stop</Text></TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  inner: { padding: 16 },
  badge: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.successLight, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, marginBottom: 20, alignSelf: "center" as const },
  badgeTxt: { fontSize: 13, fontWeight: "700" as const, color: Colors.success },
  codeCard: { backgroundColor: Colors.white, borderRadius: 24, padding: 28, alignItems: "center" as const, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 16, elevation: 5, borderWidth: 2, borderColor: Colors.primaryFaded },
  codeLbl: { fontSize: 11, color: Colors.gray500, fontWeight: "600" as const, marginBottom: 16, letterSpacing: 1.5 },
  codeRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  cell: { width: CW, height: 56, borderRadius: 12, backgroundColor: Colors.gray50, borderWidth: 2, borderColor: Colors.primary, alignItems: "center" as const, justifyContent: "center" as const },
  cellTxt: { fontSize: 24, fontWeight: "900" as const, color: Colors.primary, fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace" },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  timerTxt: { fontSize: 13, color: Colors.gray500, fontWeight: "500" as const },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: Colors.primaryFaded, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  copyTxt: { fontSize: 13, fontWeight: "600" as const, color: Colors.primary },
  qrWrap: { alignItems: "center" as const, marginBottom: 16, gap: 8 },
  qrBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: Colors.gray50, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  qrBadgeTxt: { fontSize: 11, color: Colors.gray500, fontWeight: "600" as const, letterSpacing: 0.3 },
  routeCard: { backgroundColor: Colors.white, borderRadius: 18, padding: 18, marginBottom: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  routeTitle: { fontSize: 15, fontWeight: "700" as const, color: Colors.gray800, marginBottom: 16 },
  stops: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stopCol: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  stopLbl: { fontSize: 10, color: Colors.gray400, letterSpacing: 0.8, marginBottom: 2 },
  stopName: { fontSize: 16, fontWeight: "700" as const, color: Colors.gray800 },
  routeDiv: { height: 1, backgroundColor: Colors.gray100, marginVertical: 14 },
  routeInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
  routeInfoTxt: { fontSize: 13, color: Colors.gray600, fontWeight: "500" as const },
  noWaitBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: Colors.dangerLight, padding: 12, borderRadius: 12, marginBottom: 16 },
  noWaitTxt: { fontSize: 12, color: Colors.danger, fontWeight: "500" as const, flex: 1, lineHeight: 17 },
  howTo: { backgroundColor: Colors.white, borderRadius: 18, padding: 18, marginBottom: 20 },
  howTitle: { fontSize: 15, fontWeight: "700" as const, color: Colors.gray800, marginBottom: 14 },
  step: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  stepN: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primaryFaded, alignItems: "center" as const, justifyContent: "center" as const },
  stepNTxt: { fontSize: 13, fontWeight: "700" as const, color: Colors.primary },
  stepTxt: { fontSize: 14, color: Colors.gray600, flex: 1, lineHeight: 20 },
  navBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14 },
  navTxt: { fontSize: 16, fontWeight: "700" as const, color: Colors.white },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
