import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Animated, StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck } from 'lucide-react-native';
import { startPhoneVerification, registerVerifiedPhone } from '@/services/auth';
import { usePendingVerificationStore } from '@/store/pendingVerificationStore';
import { startGpsService } from '@/services/gpsService';
import { usePermissions } from '@/hooks/usePermissions';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

type OtpParams = { phone: string };

export default function OtpVerificationScreen() {
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets();
  const params = useLocalSearchParams<OtpParams>();
  const { requestLocationPermission } = usePermissions();
  const confirmation = usePendingVerificationStore((s) => s.confirmation);
  const pendingPayload = usePendingVerificationStore((s) => s.payload);
  const setPendingVerification = usePendingVerificationStore((s) => s.set);
  const clearPendingVerification = usePendingVerificationStore((s) => s.clear);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const inputs = useRef<(TextInput | null)[]>([]);
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeIn]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const iv = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(iv);
  }, [cooldown]);

  const verifyMut = useMutation({
    mutationFn: async (code: string) => {
      if (!confirmation || !pendingPayload) throw new Error('No verification in progress — start again.');
      const result = await confirmation.confirm(code);
      const idToken = await result?.user.getIdToken();
      if (!idToken) throw new Error('Verification failed. Please try again.');
      return registerVerifiedPhone(idToken, pendingPayload);
    },
    onSuccess: async () => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      clearPendingVerification();
      const ok = await requestLocationPermission();
      if (ok) await startGpsService();
      router.replace('/(tabs)/dashboard');
    },
    onError: (_err: Error) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setDigits(Array(CODE_LENGTH).fill(''));
      inputs.current[0]?.focus();
    },
  });

  const resendMut = useMutation({
    mutationFn: async () => {
      if (!pendingPayload) throw new Error('No verification in progress — start again.');
      const newConfirmation = await startPhoneVerification(params.phone);
      setPendingVerification(newConfirmation, pendingPayload);
    },
    onSuccess: () => setCooldown(RESEND_COOLDOWN),
  });

  const setDigit = (i: number, value: string) => {
    const v = value.replace(/[^0-9]/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < CODE_LENGTH - 1) inputs.current[i + 1]?.focus();
  };

  const onKeyPress = (i: number, key: string) => {
    if (key === 'Backspace' && !digits[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const code = digits.join('');
  const complete = code.length === CODE_LENGTH;
  const errorMsg = verifyMut.isError ? (verifyMut.error?.message ?? 'Verification failed.') : (resendMut.isError ? (resendMut.error?.message ?? "Couldn't resend code.") : '');

  const doVerify = useCallback(() => {
    if (!complete || verifyMut.isPending) return;
    verifyMut.mutate(code);
  }, [complete, code, verifyMut]);

  return (
    <View style={s.root}>
      <KeyboardAvoidingView style={s.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: safeTop + 20, paddingBottom: safeBottom + 32 }]}
          keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[s.brand, { opacity: fadeIn }]}>
            <Pressable style={s.backBtn} onPress={() => router.back()} hitSlop={12}>
              <ArrowLeft size={22} color="#FFF" />
            </Pressable>
            <View style={s.logoO}><View style={s.logoI}><ShieldCheck size={32} color="#FFF" /></View></View>
            <Text style={s.appName}>Verify Your Number</Text>
            <Text style={s.appTag}>Enter the code sent to +233{params.phone}</Text>
          </Animated.View>

          <Animated.View style={[s.form, { opacity: fadeIn }]}>
            {errorMsg.length > 0 && (
              <View style={s.errBox}>
                <Text style={s.errTxt}>{errorMsg}</Text>
              </View>
            )}

            <View style={s.codeRow}>
              {digits.map((d, i) => (
                <TextInput
                  key={i}
                  ref={(r) => { inputs.current[i] = r; }}
                  style={s.cell}
                  value={d}
                  onChangeText={(v) => setDigit(i, v)}
                  onKeyPress={({ nativeEvent }) => onKeyPress(i, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                />
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [s.btn, pressed && s.btnP, (!complete || verifyMut.isPending) && s.btnD]}
              onPress={doVerify} disabled={!complete || verifyMut.isPending}
            >
              {verifyMut.isPending
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={s.btnT}>Verify & Continue</Text>
              }
            </Pressable>

            <View style={s.footer}>
              <Pressable onPress={() => resendMut.mutate()} hitSlop={8} disabled={cooldown > 0 || resendMut.isPending}>
                <Text style={s.footerLink}>
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : resendMut.isPending ? 'Sending...' : "Didn't get a code? Resend"}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  kav: { flex: 1 },
  root: { flex: 1, backgroundColor: '#1565C0' },
  scroll: { flexGrow: 1 },
  brand: { alignItems: 'center', marginBottom: 28, position: 'relative' },
  backBtn: { position: 'absolute', left: 20, top: 8, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  logoO: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  logoI: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  appName: { fontSize: 24, fontWeight: '800' as const, color: '#FFF', letterSpacing: -0.5, textAlign: 'center', paddingHorizontal: 24 },
  appTag: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 6, textAlign: 'center', paddingHorizontal: 24 },
  form: { flex: 1, backgroundColor: '#F5F9F9', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 32, alignItems: 'center' },
  errBox: { backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14, marginBottom: 18, borderLeftWidth: 4, borderLeftColor: '#C62828', width: '100%' },
  errTxt: { fontSize: 14, color: '#C62828', fontWeight: '500' as const, lineHeight: 20 },
  codeRow: { flexDirection: 'row', gap: 8, marginBottom: 28 },
  cell: { width: 44, height: 54, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0', fontSize: 22, fontWeight: '800' as const, color: '#2D3E40' },
  btn: { height: 54, borderRadius: 14, backgroundColor: '#1565C0', justifyContent: 'center', alignItems: 'center', shadowColor: '#1565C0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4, width: '100%' },
  btnP: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  btnD: { opacity: 0.5 },
  btnT: { fontSize: 17, fontWeight: '700' as const, color: '#FFF', letterSpacing: 0.3 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, paddingBottom: 16 },
  footerLink: { fontSize: 15, color: '#1565C0', fontWeight: '700' as const },
});
