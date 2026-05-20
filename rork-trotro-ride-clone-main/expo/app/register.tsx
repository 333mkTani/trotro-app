import React, { useState, useRef, memo } from "react";
import { StyleSheet, Text, View, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Animated, Alert } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, User, Phone, Lock, ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
const Colors = StaticColors;

export default function RegisterScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const { register, registerPending } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const scale = useRef(new Animated.Value(1)).current;

  const doRegister = async () => {
    if (!name.trim() || !phone.trim() || !pw.trim()) { Alert.alert("Missing Fields", "Fill all fields."); return; }
    if (pw.length < 8) { Alert.alert("Weak Password", "Min 8 characters."); return; }
    if (pw !== pw2) { Alert.alert("Mismatch", "Passwords don't match."); return; }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }), Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true })]).start();
    try { await register({ phone, password: pw, full_name: name, role: 'passenger' }); } catch (e) { const msg = e instanceof Error ? e.message : 'Try again.'; Alert.alert("Signup Failed", msg); }
  };

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={st.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={st.back} onPress={() => router.back()} activeOpacity={0.7}><ArrowLeft size={22} color={Colors.white} /></TouchableOpacity>
        <View style={st.hero}><Text style={st.title}>Create Account</Text><Text style={st.sub}>Join Trotro and ride smarter</Text></View>
        <View style={st.card}>

          <View style={st.inputs}>
            <View style={st.wrap}><User size={18} color={Colors.gray400} /><TextInput style={st.input} placeholder="Full name" placeholderTextColor={Colors.gray400} value={name} onChangeText={setName} /></View>
            <View style={st.wrap}><Phone size={18} color={Colors.gray400} /><TextInput style={st.input} placeholder="Phone (+233...)" placeholderTextColor={Colors.gray400} value={phone} onChangeText={setPhone} keyboardType="phone-pad" /></View>
            <View style={st.wrap}><Lock size={18} color={Colors.gray400} /><TextInput style={st.input} placeholder="Password (min 8)" placeholderTextColor={Colors.gray400} value={pw} onChangeText={setPw} secureTextEntry /></View>
            <View style={st.wrap}><Lock size={18} color={Colors.gray400} /><TextInput style={st.input} placeholder="Confirm password" placeholderTextColor={Colors.gray400} value={pw2} onChangeText={setPw2} secureTextEntry /></View>
          </View>
          <Animated.View style={{ transform: [{ scale }] }}>
            <TouchableOpacity style={[st.regBtn, registerPending && st.regOff]} onPress={doRegister} activeOpacity={0.8} disabled={registerPending}>
              {registerPending ? <ActivityIndicator color={Colors.white} size="small" /> : <><Text style={st.regBtnTxt}>Create Account</Text><ChevronRight size={18} color={Colors.white} /></>}
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity style={st.loginLink} onPress={() => router.back()} activeOpacity={0.6}><Text style={st.loginTxt}>Already have an account? <Text style={st.loginBold}>Sign in</Text></Text></TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.primary },
  scroll: { flexGrow: 1, paddingVertical: 60 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center" as const, justifyContent: "center" as const, marginLeft: 20, marginBottom: 20 },
  hero: { paddingHorizontal: 24, marginBottom: 28 },
  title: { fontSize: 30, fontWeight: "900" as const, color: Colors.white, marginBottom: 6 },
  sub: { fontSize: 15, color: "rgba(255,255,255,0.75)" },
  card: { backgroundColor: Colors.white, marginHorizontal: 20, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 8 },

  inputs: { gap: 12, marginBottom: 20 },
  wrap: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: Colors.gray50, borderWidth: 1, borderColor: Colors.gray200, borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === "web" ? 14 : 0, height: Platform.OS === "web" ? undefined : 52 },
  input: { flex: 1, fontSize: 15, color: Colors.gray800 },
  regBtn: { backgroundColor: Colors.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 16, borderRadius: 14, gap: 6 },
  regOff: { opacity: 0.7 },
  regBtnTxt: { fontSize: 16, fontWeight: "700" as const, color: Colors.white },
  loginLink: { marginTop: 18, alignItems: "center" as const },
  loginTxt: { fontSize: 14, color: Colors.gray500 },
  loginBold: { color: Colors.primary, fontWeight: "700" as const },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
