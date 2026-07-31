import React, { useState, useRef, useEffect } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
const Colors = StaticColors;

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

type OtpParams = { phone: string };

export default function OtpVerificationScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const params = useLocalSearchParams<OtpParams>();
  const { pendingVerification, startPhoneVerification, confirmPhoneVerification, confirmPhoneVerificationPending } = useAuth();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [resending, setResending] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const iv = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(iv);
  }, [cooldown]);

  const setDigit = (i: number, value: string) => {
    const v = value.replace(/[^0-9]/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < CODE_LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const onKeyPress = (i: number, key: string) => {
    if (key === "Backspace" && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const doVerify = async (code: string) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await confirmPhoneVerification(code);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Try again.";
      Alert.alert("Verification Failed", msg);
      setDigits(Array(CODE_LENGTH).fill(""));
      inputs.current[0]?.focus();
    }
  };

  const doResend = async () => {
    if (cooldown > 0 || resending || !pendingVerification) return;
    setResending(true);
    try {
      await startPhoneVerification(params.phone, pendingVerification.payload);
      setCooldown(RESEND_COOLDOWN);
      Alert.alert("Code Sent", "A new verification code has been sent.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Try again.";
      Alert.alert("Couldn't Resend", msg);
    } finally {
      setResending(false);
    }
  };

  const code = digits.join("");
  const complete = code.length === CODE_LENGTH;

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <TouchableOpacity style={st.back} onPress={() => router.back()} activeOpacity={0.7}><ArrowLeft size={22} color={Colors.white} /></TouchableOpacity>
      <View style={st.hero}>
        <Text style={st.title}>Verify Your Number</Text>
        <Text style={st.sub}>Enter the 6-digit code sent to {params.phone}</Text>
      </View>
      <View style={st.card}>
        <View style={st.iconWrap}><ShieldCheck size={28} color={Colors.primary} /></View>
        <View style={st.codeRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(r) => { inputs.current[i] = r; }}
              style={st.cell}
              value={d}
              onChangeText={(v) => setDigit(i, v)}
              onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
            />
          ))}
        </View>
        <TouchableOpacity
          style={[st.verifyBtn, (!complete || confirmPhoneVerificationPending) && st.verifyOff]}
          onPress={() => doVerify(code)}
          activeOpacity={0.8}
          disabled={!complete || confirmPhoneVerificationPending}
        >
          {confirmPhoneVerificationPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={st.verifyBtnTxt}>Verify & Continue</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={st.resendLink} onPress={doResend} activeOpacity={0.6} disabled={cooldown > 0 || resending}>
          <Text style={st.resendTxt}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : resending ? "Sending..." : "Didn't get a code? Resend"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary, paddingTop: 60 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center" as const, justifyContent: "center" as const, marginLeft: 20, marginBottom: 20 },
  hero: { paddingHorizontal: 24, marginBottom: 28 },
  title: { fontSize: 26, fontWeight: "900" as const, color: Colors.white, marginBottom: 6 },
  sub: { fontSize: 14, color: "rgba(255,255,255,0.75)" },
  card: { backgroundColor: Colors.white, marginHorizontal: 20, borderRadius: 24, padding: 24, alignItems: "center" as const, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
  iconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primaryFaded, alignItems: "center" as const, justifyContent: "center" as const, marginBottom: 20 },
  codeRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  cell: { width: 44, height: 52, borderRadius: 12, backgroundColor: Colors.gray50, borderWidth: 2, borderColor: Colors.gray200, fontSize: 22, fontWeight: "800" as const, color: Colors.gray800 },
  verifyBtn: { backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, width: "100%", gap: 6 },
  verifyOff: { opacity: 0.5 },
  verifyBtnTxt: { fontSize: 16, fontWeight: "700" as const, color: Colors.white },
  resendLink: { marginTop: 18, alignItems: "center" as const },
  resendTxt: { fontSize: 14, color: Colors.gray500 },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
