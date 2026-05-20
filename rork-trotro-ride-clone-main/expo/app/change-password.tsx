import React, { useCallback, useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Eye, EyeOff, Lock, Check, X } from "lucide-react-native";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";

type Strength = "weak" | "fair" | "strong";

function evaluateStrength(pw: string): Strength {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return "weak";
  if (score === 2 || score === 3) return "fair";
  return "strong";
}

export default function ChangePasswordScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  const styles = useMemo(() => makeStyles(themeColors), [themeColors]);

  const router = useRouter();

  const [current, setCurrent] = useState<string>("");
  const [next, setNext] = useState<string>("");
  const [confirm, setConfirm] = useState<string>("");
  const [showCurrent, setShowCurrent] = useState<boolean>(false);
  const [showNext, setShowNext] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const strength = useMemo(() => evaluateStrength(next), [next]);
  const rules = useMemo(() => ({
    length: next.length >= 8,
    upper: /[A-Z]/.test(next),
    number: /[0-9]/.test(next),
    symbol: /[^A-Za-z0-9]/.test(next),
  }), [next]);

  const match = confirm.length > 0 && confirm === next;
  const canSave = current.length > 0 && next.length >= 8 && match && next !== current;

  const onSave = useCallback(async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      await new Promise((r) => setTimeout(r, 900));
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Password updated", "Your password has been changed successfully.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      console.log("change password error", e);
      Alert.alert("Error", "Couldn't update password. Try again.");
    } finally {
      setSaving(false);
    }
  }, [canSave, router]);

  const strengthColor =
    strength === "strong" ? Colors.success : strength === "fair" ? Colors.warning : Colors.danger;
  const strengthWidth = strength === "strong" ? "100%" : strength === "fair" ? "66%" : "33%";

  const renderField = (
    label: string,
    value: string,
    setValue: (v: string) => void,
    show: boolean,
    toggle: () => void,
    placeholder: string,
    testID: string,
  ) => (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <Lock size={16} color={Colors.gray400} />
        <TextInput
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          placeholderTextColor={Colors.gray400}
          style={styles.input}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          testID={testID}
        />
        <TouchableOpacity onPress={toggle} hitSlop={10} activeOpacity={0.7}>
          {show ? <EyeOff size={18} color={Colors.gray500} /> : <Eye size={18} color={Colors.gray500} />}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: "Change Password",
          headerStyle: { backgroundColor: Colors.screenBg },
          headerTintColor: Colors.primary,
          headerShadowVisible: false,
        }}
      />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Lock size={24} color={Colors.primary} />
            </View>
            <Text style={styles.heroTitle}>Update your password</Text>
            <Text style={styles.heroSub}>
              Choose a strong password you don&apos;t use elsewhere to keep your account secure.
            </Text>
          </View>

          {renderField("Current password", current, setCurrent, showCurrent, () => setShowCurrent((s) => !s), "Enter current password", "input-current")}
          {renderField("New password", next, setNext, showNext, () => setShowNext((s) => !s), "At least 8 characters", "input-next")}

          {next.length > 0 && (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthBar}>
                <View style={[styles.strengthFill, { width: strengthWidth as unknown as number, backgroundColor: strengthColor }]} />
              </View>
              <Text style={[styles.strengthTxt, { color: strengthColor }]}>
                {strength === "strong" ? "Strong password" : strength === "fair" ? "Fair password" : "Weak password"}
              </Text>
            </View>
          )}

          <View style={styles.rules}>
            <Rule ok={rules.length} label="At least 8 characters" Colors={Colors} />
            <Rule ok={rules.upper} label="An uppercase letter" Colors={Colors} />
            <Rule ok={rules.number} label="A number" Colors={Colors} />
            <Rule ok={rules.symbol} label="A symbol (!@#$...)" Colors={Colors} />
          </View>

          {renderField("Confirm new password", confirm, setConfirm, showConfirm, () => setShowConfirm((s) => !s), "Re-enter new password", "input-confirm")}

          {confirm.length > 0 && !match && (
            <Text style={styles.errTxt}>Passwords don&apos;t match</Text>
          )}
          {next.length > 0 && next === current && current.length > 0 && (
            <Text style={styles.errTxt}>New password must be different from current</Text>
          )}

          <TouchableOpacity
            style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
            onPress={onSave}
            disabled={!canSave || saving}
            activeOpacity={0.85}
            testID="save-password"
          >
            {saving ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.saveBtnTxt}>Update Password</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.cancelTxt}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

function Rule({ ok, label, Colors }: { ok: boolean; label: string; Colors: ThemePalette }) {
  return (
    <View style={ruleStyles.row}>
      <View style={[ruleStyles.dot, { backgroundColor: ok ? Colors.successLight : Colors.gray100 }]}>
        {ok ? <Check size={12} color={Colors.success} /> : <X size={12} color={Colors.gray400} />}
      </View>
      <Text style={[ruleStyles.txt, { color: ok ? Colors.gray700 : Colors.gray500 }]}>{label}</Text>
    </View>
  );
}

const ruleStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  dot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  txt: { fontSize: 13, fontWeight: "500" as const },
});

const makeStyles = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  inner: { padding: 20, paddingBottom: 40 },
  hero: { alignItems: "center", marginBottom: 20, marginTop: 4 },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  heroTitle: { fontSize: 20, fontWeight: "700" as const, color: Colors.gray800 },
  heroSub: { fontSize: 13, color: Colors.gray500, textAlign: "center", marginTop: 6, paddingHorizontal: 20, lineHeight: 18 },
  section: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "700" as const, color: Colors.gray500, letterSpacing: 0.6, marginBottom: 8, textTransform: "uppercase" as const },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.white,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 6,
    borderWidth: 1,
    borderColor: Colors.gray100,
  },
  input: { flex: 1, fontSize: 15, color: Colors.gray800, paddingVertical: Platform.OS === "ios" ? 0 : 8 },
  strengthWrap: { marginTop: -4, marginBottom: 10, gap: 6 },
  strengthBar: { height: 5, borderRadius: 3, backgroundColor: Colors.gray100, overflow: "hidden" },
  strengthFill: { height: "100%", borderRadius: 3 },
  strengthTxt: { fontSize: 12, fontWeight: "600" as const },
  rules: { backgroundColor: Colors.white, borderRadius: 14, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: Colors.gray100 },
  errTxt: { fontSize: 13, color: Colors.danger, marginTop: -6, marginBottom: 8, fontWeight: "500" as const },
  saveBtn: {
    marginTop: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: { backgroundColor: Colors.gray200 },
  saveBtnTxt: { fontSize: 15, fontWeight: "700" as const, color: Colors.white },
  cancelBtn: { marginTop: 10, paddingVertical: 14, alignItems: "center" },
  cancelTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.gray500 },
});
