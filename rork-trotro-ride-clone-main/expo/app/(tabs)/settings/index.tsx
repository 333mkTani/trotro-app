import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch, Alert, Platform, Modal, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import {
  User,
  Phone,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  Trash2,
  Info,
  MessageCircle,
  Wallet as WalletIcon,
  Clock,
  MapPin,
  Lock,
  HelpCircle,
  AlertTriangle,
  Navigation,
  Database,
  Check,
  Palette,
  Sun,
  Moon,
  Smartphone,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette, type ThemeMode } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
const Colors = StaticColors;

const BUFFER_OPTIONS = [5, 10, 15, 20, 30] as const;

const THEME_OPTIONS: { value: ThemeMode; label: string; sub: string }[] = [
  { value: "light", label: "Light", sub: "Bright and clean" },
  { value: "dark", label: "Dark", sub: "Easier on the eyes" },
  { value: "system", label: "System", sub: "Match device setting" },
];

export default function SettingsScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const { user, logout } = useAuth();
  const { mode: themeMode, setThemeMode } = useTheme();
  const [showTheme, setShowTheme] = useState<boolean>(false);
  const router = useRouter();
  const [pushOn, setPushOn] = useState<boolean>(true);
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [vibrateOn, setVibrateOn] = useState<boolean>(true);
  const [busAlerts, setBusAlerts] = useState<boolean>(true);
  const [useCurrentLocation, setUseCurrentLocation] = useState<boolean>(true);
  const [biometricLock, setBiometricLock] = useState<boolean>(false);
  const [bufferTime, setBufferTime] = useState<number>(10);
  const [showBuffer, setShowBuffer] = useState<boolean>(false);

  const locationPermission: "granted" | "denied" = useCurrentLocation ? "granted" : "denied";

  const doLogout = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert("Logout", "Sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  }, [logout, router]);

  const openWallet = useCallback(() => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    router.push("/(tabs)/wallet");
  }, [router]);

  const info = useCallback((title: string, msg: string) => Alert.alert(title, msg), []);

  const initials = user?.full_name?.split(" ").map((n) => n[0]).join("").toUpperCase() ?? "?";

  return (
    <ScrollView style={st.root} contentContainerStyle={st.inner} showsVerticalScrollIndicator={false} testID="settings-scroll">
      <TouchableOpacity style={st.profile} activeOpacity={0.85} onPress={() => router.push("/edit-profile")} testID="open-edit-profile">
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={st.avatar} />
        ) : (
          <View style={st.avatar}><Text style={st.avatarTxt}>{initials}</Text></View>
        )}
        <View style={st.profInfo}>
          <Text style={st.profName} numberOfLines={1}>{user?.full_name ?? "User"}</Text>
          <Text style={st.profPhone} numberOfLines={1}>{user?.phone ?? ""}</Text>
          <View style={st.roleBadge}><Text style={st.roleTxt}>Passenger</Text></View>
        </View>
        <ChevronRight size={18} color={Colors.gray400} />
      </TouchableOpacity>

      <Text style={st.secTitle}>WALLET & PAYMENTS</Text>
      <View style={st.section}>
        <TouchableOpacity style={st.row} activeOpacity={0.6} onPress={openWallet} testID="open-wallet">
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.primaryFaded }]}><WalletIcon size={16} color={Colors.primary} /></View>
            <View style={st.rowTextWrap}>
              <Text style={st.rowLabel} numberOfLines={1}>Wallet & Transactions</Text>
              <Text style={st.rowSub} numberOfLines={1}>Manage balance and payment history</Text>
            </View>
          </View>
          <ChevronRight size={18} color={Colors.gray400} />
        </TouchableOpacity>
      </View>

      <Text style={st.secTitle}>APPEARANCE</Text>
      <View style={st.section}>
        <TouchableOpacity style={st.row} activeOpacity={0.6} onPress={() => setShowTheme(true)} testID="open-theme">
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.primaryFaded }]}><Palette size={16} color={Colors.primary} /></View>
            <View style={st.rowTextWrap}>
              <Text style={st.rowLabel} numberOfLines={1}>Theme</Text>
              <Text style={st.rowSub} numberOfLines={1}>Light, dark, or match system</Text>
            </View>
          </View>
          <View style={st.rowRight}>
            <Text style={st.rowValue}>
              {themeMode === "system" ? "System" : themeMode === "dark" ? "Dark" : "Light"}
            </Text>
            <ChevronRight size={18} color={Colors.gray400} />
          </View>
        </TouchableOpacity>
      </View>

      <Text style={st.secTitle}>RIDE PREFERENCES</Text>
      <View style={st.section}>
        <TouchableOpacity style={st.row} activeOpacity={0.6} onPress={() => setShowBuffer(true)} testID="buffer-time">
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.warningLight }]}><Clock size={16} color={Colors.warning} /></View>
            <View style={st.rowTextWrap}>
              <Text style={st.rowLabel} numberOfLines={1}>Buffer Time</Text>
              <Text style={st.rowSub} numberOfLines={1}>Notify me earlier before my ride</Text>
            </View>
          </View>
          <View style={st.rowRight}>
            <Text style={st.rowValue}>{bufferTime} min</Text>
            <ChevronRight size={18} color={Colors.gray400} />
          </View>
        </TouchableOpacity>
        <View style={st.divider} />
        <View style={st.row}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.infoLight }]}><Bell size={16} color={Colors.info} /></View>
            <View style={st.rowTextWrap}>
              <Text style={st.rowLabel} numberOfLines={1}>Bus Alerts</Text>
              <Text style={st.rowSub} numberOfLines={1}>Get notified when buses approach</Text>
            </View>
          </View>
          <Switch value={busAlerts} onValueChange={setBusAlerts} trackColor={{ false: Colors.gray200, true: Colors.primaryLight }} thumbColor={busAlerts ? Colors.primary : Colors.gray400} />
        </View>
      </View>

      <Text style={st.secTitle}>NOTIFICATIONS</Text>
      <View style={st.section}>
        <View style={st.row}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.primaryFaded }]}><Bell size={16} color={Colors.primary} /></View>
            <Text style={st.rowLabel}>Push Notifications</Text>
          </View>
          <Switch value={pushOn} onValueChange={setPushOn} trackColor={{ false: Colors.gray200, true: Colors.primaryLight }} thumbColor={pushOn ? Colors.primary : Colors.gray400} />
        </View>
        <View style={st.divider} />
        <View style={st.row}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.infoLight }]}><MessageCircle size={16} color={Colors.info} /></View>
            <Text style={st.rowLabel}>Sound Alerts</Text>
          </View>
          <Switch value={soundOn} onValueChange={setSoundOn} trackColor={{ false: Colors.gray200, true: Colors.primaryLight }} thumbColor={soundOn ? Colors.primary : Colors.gray400} />
        </View>
        <View style={st.divider} />
        <View style={st.row}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.successLight }]}><Bell size={16} color={Colors.success} /></View>
            <Text style={st.rowLabel}>Vibration</Text>
          </View>
          <Switch value={vibrateOn} onValueChange={setVibrateOn} trackColor={{ false: Colors.gray200, true: Colors.primaryLight }} thumbColor={vibrateOn ? Colors.primary : Colors.gray400} />
        </View>
      </View>

      <Text style={st.secTitle}>LOCATION</Text>
      <View style={st.section}>
        <View style={st.row}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.successLight }]}><MapPin size={16} color={Colors.success} /></View>
            <View style={st.rowTextWrap}>
              <Text style={st.rowLabel} numberOfLines={1}>Location Permission</Text>
              <Text style={st.rowSub} numberOfLines={1}>
                {locationPermission === "granted" ? "Granted" : "Denied — tap to open settings"}
              </Text>
            </View>
          </View>
          <View style={[st.statusDot, { backgroundColor: locationPermission === "granted" ? Colors.success : Colors.danger }]} />
        </View>
        <View style={st.divider} />
        <View style={st.row}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.infoLight }]}><Navigation size={16} color={Colors.info} /></View>
            <View style={st.rowTextWrap}>
              <Text style={st.rowLabel} numberOfLines={1}>Use Current Location</Text>
              <Text style={st.rowSub} numberOfLines={1}>Auto-detect your pickup point</Text>
            </View>
          </View>
          <Switch value={useCurrentLocation} onValueChange={setUseCurrentLocation} trackColor={{ false: Colors.gray200, true: Colors.primaryLight }} thumbColor={useCurrentLocation ? Colors.primary : Colors.gray400} />
        </View>
      </View>

      <Text style={st.secTitle}>PRIVACY & SECURITY</Text>
      <View style={st.section}>
        <View style={st.row}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.gray100 }]}><Lock size={16} color={Colors.gray600} /></View>
            <View style={st.rowTextWrap}>
              <Text style={st.rowLabel} numberOfLines={1}>App Lock</Text>
              <Text style={st.rowSub} numberOfLines={1}>Require biometrics to open app</Text>
            </View>
          </View>
          <Switch value={biometricLock} onValueChange={setBiometricLock} trackColor={{ false: Colors.gray200, true: Colors.primaryLight }} thumbColor={biometricLock ? Colors.primary : Colors.gray400} />
        </View>
        <View style={st.divider} />
        <TouchableOpacity style={st.row} activeOpacity={0.6} onPress={() => info("Privacy Policy", "Opens privacy policy.")}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.gray100 }]}><Shield size={16} color={Colors.gray600} /></View>
            <Text style={st.rowLabel}>Privacy Policy</Text>
          </View>
          <ChevronRight size={18} color={Colors.gray400} />
        </TouchableOpacity>
        <View style={st.divider} />
        <TouchableOpacity style={st.row} activeOpacity={0.6} onPress={() => info("Download Data", "We'll email your data archive within 24 hours.")}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.gray100 }]}><Database size={16} color={Colors.gray600} /></View>
            <Text style={st.rowLabel}>Download My Data</Text>
          </View>
          <ChevronRight size={18} color={Colors.gray400} />
        </TouchableOpacity>
      </View>

      <Text style={st.secTitle}>ACCOUNT</Text>
      <View style={st.section}>
        <TouchableOpacity style={st.row} activeOpacity={0.6} onPress={() => router.push("/edit-profile")} testID="edit-profile-row">
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.gray100 }]}><User size={16} color={Colors.gray600} /></View>
            <Text style={st.rowLabel}>Edit Profile</Text>
          </View>
          <ChevronRight size={18} color={Colors.gray400} />
        </TouchableOpacity>
        <View style={st.divider} />
        <TouchableOpacity style={st.row} activeOpacity={0.6} onPress={() => router.push("/change-password")} testID="change-password-row">
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.gray100 }]}><Shield size={16} color={Colors.gray600} /></View>
            <Text style={st.rowLabel}>Change Password</Text>
          </View>
          <ChevronRight size={18} color={Colors.gray400} />
        </TouchableOpacity>
      </View>

      <Text style={st.secTitle}>SUPPORT</Text>
      <View style={st.section}>
        <TouchableOpacity style={st.row} activeOpacity={0.6} onPress={() => info("Help & FAQ", "Opens the help center with common questions.")}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.infoLight }]}><HelpCircle size={16} color={Colors.info} /></View>
            <Text style={st.rowLabel}>Help & FAQ</Text>
          </View>
          <ChevronRight size={18} color={Colors.gray400} />
        </TouchableOpacity>
        <View style={st.divider} />
        <TouchableOpacity style={st.row} activeOpacity={0.6} onPress={() => info("Report an Issue", "Describe the issue and we'll get back to you.")}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.warningLight }]}><AlertTriangle size={16} color={Colors.warning} /></View>
            <Text style={st.rowLabel}>Report an Issue</Text>
          </View>
          <ChevronRight size={18} color={Colors.gray400} />
        </TouchableOpacity>
        <View style={st.divider} />
        <TouchableOpacity style={st.row} activeOpacity={0.6}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.gray100 }]}><Phone size={16} color={Colors.gray600} /></View>
            <Text style={st.rowLabel}>Contact Support</Text>
          </View>
          <ChevronRight size={18} color={Colors.gray400} />
        </TouchableOpacity>
        <View style={st.divider} />
        <TouchableOpacity style={st.row} activeOpacity={0.6}>
          <View style={st.rowLeft}>
            <View style={[st.icon, { backgroundColor: Colors.gray100 }]}><Info size={16} color={Colors.gray600} /></View>
            <Text style={st.rowLabel}>About Trotro</Text>
          </View>
          <ChevronRight size={18} color={Colors.gray400} />
        </TouchableOpacity>
      </View>

      <View style={st.danger}>
        <TouchableOpacity style={st.logoutBtn} onPress={doLogout} activeOpacity={0.7} testID="logout-btn">
          <LogOut size={18} color={Colors.danger} />
          <Text style={st.logoutTxt}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.deleteBtn} onPress={() => Alert.alert("Delete Account", "This cannot be undone.", [{ text: "Cancel" }, { text: "Delete", style: "destructive" }])} activeOpacity={0.7}>
          <Trash2 size={16} color={Colors.gray400} />
          <Text style={st.deleteTxt}>Delete Account</Text>
        </TouchableOpacity>
      </View>
      <Text style={st.version}>Trotro v1.0.0</Text>
      <View style={{ height: 20 }} />

      <Modal visible={showBuffer} transparent animationType="fade" onRequestClose={() => setShowBuffer(false)}>
        <Pressable style={st.backdrop} onPress={() => setShowBuffer(false)}>
          <Pressable style={st.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>Buffer Time</Text>
            <Text style={st.sheetSub}>How early should we notify you?</Text>
            <View style={{ height: 12 }} />
            {BUFFER_OPTIONS.map((m) => {
              const active = m === bufferTime;
              return (
                <TouchableOpacity
                  key={m}
                  style={[st.optionRow, active && st.optionRowActive]}
                  onPress={() => {
                    setBufferTime(m);
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    setShowBuffer(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[st.optionTxt, active && st.optionTxtActive]}>{m} minutes</Text>
                  {active && <Check size={18} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={showTheme} transparent animationType="fade" onRequestClose={() => setShowTheme(false)}>
        <Pressable style={st.backdrop} onPress={() => setShowTheme(false)}>
          <Pressable style={st.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={st.sheetHandle} />
            <Text style={st.sheetTitle}>Theme</Text>
            <Text style={st.sheetSub}>Choose how the app should look</Text>
            <View style={{ height: 12 }} />
            {THEME_OPTIONS.map((opt) => {
              const active = opt.value === themeMode;
              const Icon = opt.value === "light" ? Sun : opt.value === "dark" ? Moon : Smartphone;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[st.themeRow, active && st.optionRowActive]}
                  onPress={async () => {
                    if (Platform.OS !== "web") Haptics.selectionAsync();
                    await setThemeMode(opt.value);
                    setShowTheme(false);
                  }}
                  activeOpacity={0.7}
                  testID={`theme-${opt.value}`}
                >
                  <View style={[st.icon, { backgroundColor: active ? Colors.primaryFaded : Colors.gray100 }]}>
                    <Icon size={16} color={active ? Colors.primary : Colors.gray600} />
                  </View>
                  <View style={st.themeTextWrap}>
                    <Text style={[st.optionTxt, active && st.optionTxtActive]}>{opt.label}</Text>
                    <Text style={st.rowSub}>{opt.sub}</Text>
                  </View>
                  {active && <Check size={18} color={Colors.primary} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  inner: { paddingTop: 12 },
  profile: { flexDirection: "row", alignItems: "center", backgroundColor: Colors.white, marginHorizontal: 16, padding: 18, borderRadius: 18, marginBottom: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  avatar: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colors.primary, alignItems: "center" as const, justifyContent: "center" as const },
  avatarTxt: { fontSize: 20, fontWeight: "800" as const, color: Colors.white },
  profInfo: { marginLeft: 14, flex: 1 },
  profName: { fontSize: 18, fontWeight: "700" as const, color: Colors.gray800 },
  profPhone: { fontSize: 13, color: Colors.gray500, marginTop: 2 },
  roleBadge: { backgroundColor: Colors.primaryFaded, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" as const, marginTop: 6 },
  roleTxt: { fontSize: 11, fontWeight: "700" as const, color: Colors.primary, textTransform: "uppercase" as const },
  secTitle: { fontSize: 11, fontWeight: "700" as const, color: Colors.gray400, letterSpacing: 1, marginLeft: 20, marginBottom: 8 },
  section: { backgroundColor: Colors.white, marginHorizontal: 16, borderRadius: 16, marginBottom: 24, overflow: "hidden" as const },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowTextWrap: { flex: 1, minWidth: 0 },
  icon: { width: 34, height: 34, borderRadius: 9, alignItems: "center" as const, justifyContent: "center" as const },
  rowLabel: { fontSize: 15, fontWeight: "500" as const, color: Colors.gray700 },
  rowSub: { fontSize: 12, color: Colors.gray400, marginTop: 2 },
  rowValue: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  divider: { height: 1, backgroundColor: Colors.gray100, marginLeft: 62 },
  danger: { marginHorizontal: 16, gap: 10, marginBottom: 20 },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: Colors.dangerLight, paddingVertical: 15, borderRadius: 14 },
  logoutTxt: { fontSize: 15, fontWeight: "700" as const, color: Colors.danger },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  deleteTxt: { fontSize: 13, color: Colors.gray400 },
  version: { textAlign: "center" as const, fontSize: 12, color: Colors.gray300, marginBottom: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: Colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.gray200, alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.gray800 },
  sheetSub: { fontSize: 13, color: Colors.gray500, marginTop: 4 },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 14, borderRadius: 12, marginTop: 6, backgroundColor: Colors.screenBg },
  optionRowActive: { backgroundColor: Colors.primaryFaded },
  optionTxt: { fontSize: 15, fontWeight: "500" as const, color: Colors.gray700 },
  optionTxtActive: { color: Colors.primary, fontWeight: "700" as const },
  themeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, marginTop: 6, backgroundColor: Colors.screenBg },
  themeTextWrap: { flex: 1, minWidth: 0 },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
