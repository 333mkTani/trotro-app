import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Animated, StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Phone, Lock, Eye, EyeOff, Bus, User, ArrowLeft } from 'lucide-react-native';
import { register as performRegister } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';
import { startGpsService } from '@/services/gpsService';
import { usePermissions } from '@/hooks/usePermissions';

export default function RegisterScreen() {
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [ph, setPh] = useState('');
  const [pw, setPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwVis, setPwVis] = useState(false);
  const [confirmPwVis, setConfirmPwVis] = useState(false);
  const [localError, setLocalError] = useState('');
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  const { requestLocationPermission } = usePermissions();
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();
  }, [fadeIn, slideUp]);

  useEffect(() => {
    if (isAuth) {
      router.replace('/(tabs)');
    }
  }, [isAuth]);

  const registerMut = useMutation({
    mutationFn: () => performRegister(ph, pw, fullName),
    onSuccess: async () => {
      console.log('[Register] Success');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const ok = await requestLocationPermission();
      if (ok) await startGpsService();
      router.replace('/(tabs)');
    },
    onError: (err: Error) => {
      console.log('[Register] Error:', err.message);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const doRegister = useCallback(() => {
    setLocalError('');
    if (!fullName.trim()) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (!ph.trim()) {
      setLocalError('Please enter your phone number.');
      return;
    }
    if (pw.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }
    if (pw !== confirmPw) {
      setLocalError('Passwords do not match.');
      return;
    }
    registerMut.mutate();
  }, [fullName, ph, pw, confirmPw, registerMut]);

  const canSubmit = fullName.trim().length > 0 && ph.trim().length > 0 && pw.length >= 6 && confirmPw.length > 0;
  const errorMsg = localError || (registerMut.isError ? (registerMut.error?.message ?? 'Registration failed.') : '');

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
            <View style={s.logoO}><View style={s.logoI}><Bus size={32} color="#FFF" /></View></View>
            <Text style={s.appName}>Trotro Driver</Text>
            <Text style={s.appTag}>Create your account</Text>
          </Animated.View>

          <Animated.View style={[s.form, { transform: [{ translateY: slideUp }] }]}>
            <Text style={s.hello}>Get Started</Text>
            <Text style={s.helloSub}>Register to start driving</Text>

            {errorMsg.length > 0 && (
              <View style={s.errBox} testID="register-error">
                <Text style={s.errTxt}>{errorMsg}</Text>
              </View>
            )}

            <View style={s.fields}>
              <View style={s.inputRow}>
                <View style={s.ic}><User size={18} color="#64748B" /></View>
                <TextInput
                  style={s.inp} placeholder="Full name" placeholderTextColor="#94A3B8"
                  value={fullName} onChangeText={setFullName} autoCapitalize="words"
                  autoCorrect={false} testID="name-input"
                />
              </View>

              <View style={s.inputRow}>
                <View style={s.ic}><Phone size={18} color="#64748B" /></View>
                <Text style={s.pre}>+233</Text>
                <TextInput
                  style={s.inp} placeholder="Phone number" placeholderTextColor="#94A3B8"
                  value={ph} onChangeText={setPh} keyboardType="phone-pad"
                  autoCapitalize="none" autoCorrect={false} testID="phone-input"
                />
              </View>

              <View style={s.inputRow}>
                <View style={s.ic}><Lock size={18} color="#64748B" /></View>
                <TextInput
                  style={[s.inp, s.passInp]} placeholder="Password (min 6 chars)" placeholderTextColor="#94A3B8"
                  value={pw} onChangeText={setPw} secureTextEntry={!pwVis}
                  autoCapitalize="none" autoCorrect={false} testID="password-input"
                />
                <Pressable onPress={() => setPwVis((v) => !v)} style={s.eye} hitSlop={12}>
                  {pwVis ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                </Pressable>
              </View>

              <View style={s.inputRow}>
                <View style={s.ic}><Lock size={18} color="#64748B" /></View>
                <TextInput
                  style={[s.inp, s.passInp]} placeholder="Confirm password" placeholderTextColor="#94A3B8"
                  value={confirmPw} onChangeText={setConfirmPw} secureTextEntry={!confirmPwVis}
                  autoCapitalize="none" autoCorrect={false} testID="confirm-password-input"
                />
                <Pressable onPress={() => setConfirmPwVis((v) => !v)} style={s.eye} hitSlop={12}>
                  {confirmPwVis ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [s.btn, pressed && s.btnP, !canSubmit && s.btnD]}
              onPress={doRegister} disabled={registerMut.isPending || !canSubmit} testID="register-btn"
            >
              {registerMut.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={s.btnT}>Create Account</Text>}
            </Pressable>

            <View style={s.footer}>
              <Text style={s.footerTxt}>Already have an account? </Text>
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <Text style={s.footerLink}>Sign In</Text>
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
  appName: { fontSize: 28, fontWeight: '800' as const, color: '#FFF', letterSpacing: -0.5 },
  appTag: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 4 },
  form: { flex: 1, backgroundColor: '#F5F9F9', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 32 },
  hello: { fontSize: 24, fontWeight: '700' as const, color: '#2D3E40', marginBottom: 4 },
  helloSub: { fontSize: 15, color: '#64748B', marginBottom: 24 },
  errBox: { backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14, marginBottom: 18, borderLeftWidth: 4, borderLeftColor: '#C62828' },
  errTxt: { fontSize: 14, color: '#C62828', fontWeight: '500' as const, lineHeight: 20 },
  fields: { gap: 12, marginBottom: 24 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', height: 56, paddingHorizontal: 4 },
  ic: { width: 44, justifyContent: 'center', alignItems: 'center' },
  pre: { fontSize: 16, color: '#2D3E40', fontWeight: '500' as const, marginRight: 6 },
  inp: { flex: 1, fontSize: 16, color: '#2D3E40', height: '100%', paddingRight: 16 },
  passInp: { paddingRight: 48 },
  eye: { position: 'absolute', right: 16 },
  btn: { height: 54, borderRadius: 14, backgroundColor: '#1565C0', justifyContent: 'center', alignItems: 'center', shadowColor: '#1565C0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnP: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  btnD: { opacity: 0.5 },
  btnT: { fontSize: 17, fontWeight: '700' as const, color: '#FFF', letterSpacing: 0.3 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, paddingBottom: 16 },
  footerTxt: { fontSize: 15, color: '#64748B' },
  footerLink: { fontSize: 15, color: '#1565C0', fontWeight: '700' as const },
});
