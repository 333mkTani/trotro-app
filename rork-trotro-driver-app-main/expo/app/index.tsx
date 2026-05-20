import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Animated, StyleSheet,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Phone, Lock, Eye, EyeOff, Bus } from 'lucide-react-native';
import { login as performLogin } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';
import { startGpsService } from '@/services/gpsService';
import { usePermissions } from '@/hooks/usePermissions';

export default function TrotroDriverLoginPage() {
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets();
  const [ph, setPh] = useState('');
  const [pw, setPw] = useState('');
  const [pwVis, setPwVis] = useState(false);
  const isAuth = useAuthStore((s) => s.isAuthenticated);
  const isBootLoading = useAuthStore((s) => s.isLoading);
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
    if (isAuth && !isBootLoading) {
      console.log('[Login] Already authenticated, going to dashboard');
      router.replace('/(tabs)/dashboard');
    }
  }, [isAuth, isBootLoading]);

  const loginMut = useMutation({
    mutationFn: () => performLogin(ph, pw),
    onSuccess: async () => {
      console.log('[Login] Success');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const ok = await requestLocationPermission();
      if (ok) await startGpsService();
      router.replace('/(tabs)/dashboard');
    },
    onError: (err: Error) => {
      console.log('[Login] Error:', err.message);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const doLogin = useCallback(() => {
    if (!ph.trim() || !pw.trim()) return;
    loginMut.mutate();
  }, [ph, pw, loginMut]);

  if (isBootLoading) {
    return (
      <View style={ls.boot}>
        <View style={ls.bootLogo}><Bus size={36} color="#1565C0" /></View>
        <ActivityIndicator size="large" color="#1565C0" style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (isAuth) return null;

  const canSubmit = ph.trim().length > 0 && pw.trim().length > 0;

  return (
    <View style={ls.root}>
      <KeyboardAvoidingView style={ls.kav} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={[ls.scroll, { paddingTop: safeTop + 52, paddingBottom: safeBottom + 32 }]}
          keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[ls.brand, { opacity: fadeIn }]}>
            <View style={ls.logoO}><View style={ls.logoI}><Bus size={36} color="#FFF" /></View></View>
            <Text style={ls.appName}>Trotro Driver</Text>
            <Text style={ls.appTag}>Ride Coordination System</Text>
          </Animated.View>

          <Animated.View style={[ls.form, { transform: [{ translateY: slideUp }] }]}>
            <Text style={ls.hello}>Welcome back</Text>
            <Text style={ls.helloSub}>Sign in to start driving</Text>

            {loginMut.isError && (
              <View style={ls.errBox} testID="login-error">
                <Text style={ls.errTxt}>{loginMut.error?.message ?? 'Login failed.'}</Text>
              </View>
            )}

            <View style={ls.fields}>
              <View style={ls.inputRow}>
                <View style={ls.ic}><Phone size={18} color="#64748B" /></View>
                <Text style={ls.pre}>+233</Text>
                <TextInput style={ls.inp} placeholder="Phone number" placeholderTextColor="#94A3B8" value={ph} onChangeText={setPh} keyboardType="phone-pad" autoCapitalize="none" autoCorrect={false} testID="phone-input" />
              </View>
              <View style={ls.inputRow}>
                <View style={ls.ic}><Lock size={18} color="#64748B" /></View>
                <TextInput style={[ls.inp, ls.passInp]} placeholder="Password" placeholderTextColor="#94A3B8" value={pw} onChangeText={setPw} secureTextEntry={!pwVis} autoCapitalize="none" autoCorrect={false} testID="password-input" />
                <Pressable onPress={() => setPwVis((v) => !v)} style={ls.eye} hitSlop={12}>
                  {pwVis ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                </Pressable>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [ls.btn, pressed && ls.btnP, !canSubmit && ls.btnD]}
              onPress={doLogin} disabled={loginMut.isPending || !canSubmit} testID="login-btn"
            >
              {loginMut.isPending ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={ls.btnT}>Sign In</Text>}
            </Pressable>

            <View style={ls.footer}>
              <Text style={ls.footerTxt}>Don't have an account? </Text>
              <Pressable onPress={() => router.push('/register')} hitSlop={8}>
                <Text style={ls.footerLink}>Sign Up</Text>
              </Pressable>
            </View>

            <View style={ls.demoBox}>
              <Text style={ls.demoTitle}>Demo Credentials</Text>
              <Text style={ls.demoTxt}>Phone: 241234567  |  Password: driver123</Text>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const ls = StyleSheet.create({
  kav: { flex: 1 },
  root: { flex: 1, backgroundColor: '#1565C0' },
  boot: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F9F9' },
  bootLogo: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center' },
  scroll: { flexGrow: 1 },
  brand: { alignItems: 'center', marginBottom: 40 },
  logoO: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  logoI: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  appName: { fontSize: 32, fontWeight: '800' as const, color: '#FFF', letterSpacing: -0.5 },
  appTag: { fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 6 },
  form: { flex: 1, backgroundColor: '#F5F9F9', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 36 },
  hello: { fontSize: 26, fontWeight: '700' as const, color: '#2D3E40', marginBottom: 4 },
  helloSub: { fontSize: 15, color: '#64748B', marginBottom: 28 },
  errBox: { backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#C62828' },
  errTxt: { fontSize: 14, color: '#C62828', fontWeight: '500' as const, lineHeight: 20 },
  fields: { gap: 14, marginBottom: 28 },
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
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24 },
  footerTxt: { fontSize: 15, color: '#64748B' },
  footerLink: { fontSize: 15, color: '#1565C0', fontWeight: '700' as const },
  demoBox: { marginTop: 20, backgroundColor: '#EBF4FF', borderRadius: 12, padding: 14, alignItems: 'center' },
  demoTitle: { fontSize: 13, fontWeight: '700' as const, color: '#1565C0', marginBottom: 4 },
  demoTxt: { fontSize: 13, color: '#64748B' },
});
