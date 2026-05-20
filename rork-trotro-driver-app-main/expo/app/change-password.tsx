import React, { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Platform, ActivityIndicator, KeyboardAvoidingView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Lock, Eye, EyeOff, Check, ShieldCheck } from 'lucide-react-native';
import { useMutation } from '@tanstack/react-query';
import Colors from '@/constants/colors';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  testID: string;
}

function PasswordField({ label, value, onChangeText, placeholder, testID }: FieldProps) {
  const [visible, setVisible] = useState<boolean>(false);
  return (
    <View style={s.field}>
      <View style={s.fieldIcon}><Lock size={18} color={Colors.primary} /></View>
      <View style={s.fieldBody}>
        <Text style={s.fieldLabel}>{label}</Text>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor={Colors.disabled}
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
            testID={testID}
          />
          <Pressable onPress={() => setVisible((v) => !v)} hitSlop={10} testID={`${testID}-toggle`}>
            {visible ? <EyeOff size={18} color={Colors.textSecondary} /> : <Eye size={18} color={Colors.textSecondary} />}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length >= 12) score++;
  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  const colors = [Colors.error, Colors.error, Colors.warning, Colors.gold, Colors.success, Colors.success];
  return { score, label: labels[score], color: colors[score] };
}

export default function ChangePasswordScreen() {
  const [current, setCurrent] = useState<string>('');
  const [next, setNext] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');

  const strength = useMemo(() => getStrength(next), [next]);

  const changeMutation = useMutation({
    mutationFn: async () => {
      console.log('[ChangePassword] Submitting');
      await new Promise((resolve) => setTimeout(resolve, 700));
      return true;
    },
    onSuccess: () => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Password Updated', 'Your password has been changed successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: (err: Error) => Alert.alert('Error', err.message),
  });

  const handleSubmit = useCallback(() => {
    if (!current) {
      Alert.alert('Missing', 'Please enter your current password.');
      return;
    }
    if (next.length < 8) {
      Alert.alert('Weak password', 'New password must be at least 8 characters.');
      return;
    }
    if (next === current) {
      Alert.alert('Same password', 'New password must differ from your current password.');
      return;
    }
    if (next !== confirm) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    changeMutation.mutate();
  }, [current, next, confirm, changeMutation]);

  const canSubmit = current.length > 0 && next.length >= 8 && next === confirm && !changeMutation.isPending;

  const rules: { ok: boolean; label: string }[] = [
    { ok: next.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(next), label: 'One uppercase letter' },
    { ok: /[0-9]/.test(next), label: 'One number' },
    { ok: /[^A-Za-z0-9]/.test(next), label: 'One special character' },
  ];

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.header}>
          <View style={s.headerIcon}>
            <ShieldCheck size={28} color={Colors.primary} />
          </View>
          <Text style={s.headerTitle}>Secure your account</Text>
          <Text style={s.headerSubtitle}>
            Choose a strong password you haven&apos;t used before to keep your account safe.
          </Text>
        </View>

        <View style={s.section}>
          <PasswordField
            label="Current Password"
            value={current}
            onChangeText={setCurrent}
            placeholder="Enter current password"
            testID="input-current"
          />
          <PasswordField
            label="New Password"
            value={next}
            onChangeText={setNext}
            placeholder="At least 8 characters"
            testID="input-new"
          />
          <PasswordField
            label="Confirm New Password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter new password"
            testID="input-confirm"
          />
        </View>

        {next.length > 0 && (
          <View style={s.strengthCard}>
            <View style={s.strengthHeader}>
              <Text style={s.strengthLabel}>Password strength</Text>
              <Text style={[s.strengthValue, { color: strength.color }]}>{strength.label}</Text>
            </View>
            <View style={s.strengthBars}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View
                  key={i}
                  style={[
                    s.strengthBar,
                    { backgroundColor: i < strength.score ? strength.color : Colors.borderLight },
                  ]}
                />
              ))}
            </View>
            <View style={s.rules}>
              {rules.map((r) => (
                <View key={r.label} style={s.ruleRow}>
                  <View style={[s.ruleDot, r.ok && s.ruleDotOk]}>
                    {r.ok && <Check size={10} color={Colors.white} />}
                  </View>
                  <Text style={[s.ruleText, r.ok && s.ruleTextOk]}>{r.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {confirm.length > 0 && next !== confirm && (
          <Text style={s.mismatch}>Passwords don&apos;t match</Text>
        )}
      </ScrollView>

      <View style={s.footer}>
        <Pressable
          style={({ pressed }) => [
            s.saveBtn,
            !canSubmit && s.saveBtnDisabled,
            pressed && canSubmit && { opacity: 0.9 },
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          testID="submit-change-password"
        >
          {changeMutation.isPending ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={s.saveBtnText}>Update Password</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 24 },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  section: { marginBottom: 16 },
  field: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fieldBody: { flex: 1 },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    fontSize: 16,
    color: Colors.textPrimary,
    fontWeight: '500' as const,
    padding: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  strengthCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 14,
    marginBottom: 12,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  strengthLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  strengthValue: { fontSize: 13, fontWeight: '700' as const },
  strengthBars: { flexDirection: 'row', gap: 4, marginBottom: 14 },
  strengthBar: { flex: 1, height: 5, borderRadius: 3 },
  rules: { gap: 8 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ruleDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ruleDotOk: { backgroundColor: Colors.success },
  ruleText: { fontSize: 13, color: Colors.textSecondary },
  ruleTextOk: { color: Colors.textPrimary, fontWeight: '500' as const },
  mismatch: {
    fontSize: 13,
    color: Colors.error,
    marginTop: 4,
    marginLeft: 4,
    fontWeight: '500' as const,
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnDisabled: { backgroundColor: Colors.disabled },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
