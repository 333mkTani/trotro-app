import React, { useState, useRef, memo } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Animated, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Bus, Phone, Lock, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
const Colors = StaticColors;

export default function LoginScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const { login, loginPending } = useAuth();
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const scale = useRef(new Animated.Value(1)).current;

  const doLogin = async () => {
    if (!phone.trim() || !pw.trim()) { Alert.alert("Missing Fields", "Enter phone and password."); return; }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }), Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true })]).start();
    try { await login({ phone, password: pw, role: 'passenger' }); } catch (e) { const msg = e instanceof Error ? e.message : 'Invalid credentials.'; Alert.alert("Login Failed", msg); }
  };

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={st.hero}>
          <View style={st.logoBg}><Bus size={40} color={Colors.white} /></View>
          <Text style={st.appName}>Trotro</Text>
          <Text style={st.tagline}>Ghana's smart transit companion</Text>
        </View>
        <View style={st.card}>
          <Text style={st.cardTitle}>Welcome back</Text>
          <Text style={st.cardSub}>Sign in to continue your journey</Text>

          <View style={st.inputs}>
            <View style={st.inputWrap}><Phone size={18} color={Colors.gray400} /><TextInput style={st.input} placeholder="Phone (+233...)" placeholderTextColor={Colors.gray400} value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="login-phone" /></View>
            <View style={st.inputWrap}><Lock size={18} color={Colors.gray400} /><TextInput style={st.input} placeholder="Password" placeholderTextColor={Colors.gray400} value={pw} onChangeText={setPw} secureTextEntry testID="login-pw" /></View>
          </View>
          <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity style={[st.loginBtn, loginPending && st.loginOff]} onPress={doLogin} activeOpacity={0.8} disabled={loginPending} testID="login-btn">
              {loginPending ? <ActivityIndicator color={Colors.white} size="small" /> : <><Text style={st.loginTxt}>Sign In</Text><ChevronRight size={18} color={Colors.white} /></>}
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity style={st.regLink} onPress={() => router.push("/register")} activeOpacity={0.6}><Text style={st.regTxt}>Don't have an account? <Text style={st.regBold}>Sign up</Text></Text></TouchableOpacity>
        </View>
        <Text style={st.demo}>Demo: Enter any phone & password to login</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, justifyContent: "center" as const, paddingVertical: 60 },
  hero: { alignItems: "center" as const, marginBottom: 32 },
  logoBg: { width: 80, height: 80, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center" as const, justifyContent: "center" as const, marginBottom: 16 },
  appName: { fontSize: 36, fontWeight: "900" as const, color: Colors.white, letterSpacing: -1 },
  tagline: { fontSize: 15, color: "rgba(255,255,255,0.75)", marginTop: 4 },
  card: { backgroundColor: Colors.white, marginHorizontal: 20, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },
  cardTitle: { fontSize: 22, fontWeight: "800" as const, color: Colors.gray800, marginBottom: 4 },
  cardSub: { fontSize: 14, color: Colors.gray500, marginBottom: 20 },

  inputs: { gap: 12, marginBottom: 20 },
  inputWrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.gray50, borderWidth: 1, borderColor: Colors.gray200, borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === "web" ? 14 : 0, height: Platform.OS === "web" ? undefined : 52 },
  input: { flex: 1, fontSize: 15, color: Colors.gray800 },
  loginBtn: { backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, gap: 6 },
  loginOff: { opacity: 0.7 },
  loginTxt: { fontSize: 16, fontWeight: "700" as const, color: Colors.white },
  regLink: { marginTop: 18, alignItems: "center" as const },
  regTxt: { fontSize: 14, color: Colors.gray500 },
  regBold: { color: Colors.primary, fontWeight: "700" as const },
  demo: { textAlign: "center" as const, fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 20 },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
