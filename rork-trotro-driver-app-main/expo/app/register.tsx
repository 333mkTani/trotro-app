import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Animated, StyleSheet,
  Modal, FlatList, TouchableOpacity,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from '@tanstack/react-query';
import { Phone, Lock, Eye, EyeOff, Bus, User, ArrowLeft, ChevronDown, Hash } from 'lucide-react-native';
import { register as performRegister } from '@/services/auth';
import { useAuthStore } from '@/store/authStore';
import { startGpsService } from '@/services/gpsService';
import { usePermissions } from '@/hooks/usePermissions';
import api from '@/services/api';

interface Route { id: string; name: string; origin: string; destination: string; }

export default function RegisterScreen() {
  const { top: safeTop, bottom: safeBottom } = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [ph, setPh] = useState('');
  const [pw, setPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [busPlate, setBusPlate] = useState('');
  const [totalSeats, setTotalSeats] = useState('14');
  const [routeId, setRouteId] = useState('');
  const [routeName, setRouteName] = useState('');
  const [routes, setRoutes] = useState<Route[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
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
    setLoadingRoutes(true);
    api.get('/routes')
      .then(({ data }) => setRoutes(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingRoutes(false));
  }, [fadeIn, slideUp]);

  useEffect(() => {
    if (isAuth) router.replace('/(tabs)/dashboard');
  }, [isAuth]);

  const registerMut = useMutation({
    mutationFn: () => performRegister(
      ph, pw, fullName,
      busPlate.trim() || undefined,
      routeId || undefined,
      parseInt(totalSeats, 10) || 14,
    ),
    onSuccess: async () => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const ok = await requestLocationPermission();
      if (ok) await startGpsService();
      router.replace('/(tabs)/dashboard');
    },
    onError: (_err: Error) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const doRegister = useCallback(() => {
    setLocalError('');
    if (!fullName.trim()) { setLocalError('Please enter your full name.'); return; }
    if (!ph.trim()) { setLocalError('Please enter your phone number.'); return; }
    if (pw.length < 6) { setLocalError('Password must be at least 6 characters.'); return; }
    if (pw !== confirmPw) { setLocalError('Passwords do not match.'); return; }
    if (!busPlate.trim()) { setLocalError('Please enter your bus registration plate.'); return; }
    if (!routeId) { setLocalError('Please select the route you operate on.'); return; }
    registerMut.mutate();
  }, [fullName, ph, pw, confirmPw, busPlate, routeId, registerMut]);

  const canSubmit = fullName.trim().length > 0 && ph.trim().length > 0
    && pw.length >= 6 && confirmPw.length > 0 && busPlate.trim().length > 0 && !!routeId;
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
              <View style={s.errBox}>
                <Text style={s.errTxt}>{errorMsg}</Text>
              </View>
            )}

            <Text style={s.section}>Personal Details</Text>
            <View style={s.fields}>
              <View style={s.inputRow}>
                <View style={s.ic}><User size={18} color="#64748B" /></View>
                <TextInput style={s.inp} placeholder="Full name" placeholderTextColor="#94A3B8"
                  value={fullName} onChangeText={setFullName} autoCapitalize="words" autoCorrect={false} />
              </View>

              <View style={s.inputRow}>
                <View style={s.ic}><Phone size={18} color="#64748B" /></View>
                <Text style={s.pre}>+233</Text>
                <TextInput style={s.inp} placeholder="Phone number" placeholderTextColor="#94A3B8"
                  value={ph} onChangeText={setPh} keyboardType="phone-pad" autoCapitalize="none" autoCorrect={false} />
              </View>

              <View style={s.inputRow}>
                <View style={s.ic}><Lock size={18} color="#64748B" /></View>
                <TextInput style={[s.inp, s.passInp]} placeholder="Password (min 6 chars)" placeholderTextColor="#94A3B8"
                  value={pw} onChangeText={setPw} secureTextEntry={!pwVis} autoCapitalize="none" autoCorrect={false} />
                <Pressable onPress={() => setPwVis((v) => !v)} style={s.eye} hitSlop={12}>
                  {pwVis ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                </Pressable>
              </View>

              <View style={s.inputRow}>
                <View style={s.ic}><Lock size={18} color="#64748B" /></View>
                <TextInput style={[s.inp, s.passInp]} placeholder="Confirm password" placeholderTextColor="#94A3B8"
                  value={confirmPw} onChangeText={setConfirmPw} secureTextEntry={!confirmPwVis} autoCapitalize="none" autoCorrect={false} />
                <Pressable onPress={() => setConfirmPwVis((v) => !v)} style={s.eye} hitSlop={12}>
                  {confirmPwVis ? <EyeOff size={18} color="#64748B" /> : <Eye size={18} color="#64748B" />}
                </Pressable>
              </View>
            </View>

            <Text style={s.section}>Bus Details</Text>
            <View style={s.fields}>
              <View style={s.inputRow}>
                <View style={s.ic}><Bus size={18} color="#64748B" /></View>
                <TextInput style={s.inp} placeholder="Bus plate (e.g. GR-1234-24)" placeholderTextColor="#94A3B8"
                  value={busPlate} onChangeText={setBusPlate} autoCapitalize="characters" autoCorrect={false} />
              </View>

              <TouchableOpacity style={[s.inputRow, s.pickerRow]} onPress={() => setShowPicker(true)} activeOpacity={0.7}>
                <View style={s.ic}><Bus size={18} color="#64748B" /></View>
                {loadingRoutes
                  ? <ActivityIndicator size="small" color="#94A3B8" style={{ flex: 1 }} />
                  : <Text style={[s.inp, !routeId && s.placeholder]} numberOfLines={1}>
                      {routeId ? routeName : 'Select your route'}
                    </Text>
                }
                <ChevronDown size={18} color="#64748B" style={{ marginRight: 14 }} />
              </TouchableOpacity>

              <View style={s.inputRow}>
                <View style={s.ic}><Hash size={18} color="#64748B" /></View>
                <TextInput style={s.inp} placeholder="Total seats (default 14)" placeholderTextColor="#94A3B8"
                  value={totalSeats} onChangeText={setTotalSeats} keyboardType="number-pad" />
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [s.btn, pressed && s.btnP, !canSubmit && s.btnD]}
              onPress={doRegister} disabled={registerMut.isPending || !canSubmit}
            >
              {registerMut.isPending
                ? <ActivityIndicator color="#FFF" size="small" />
                : <Text style={s.btnT}>Create Account</Text>
              }
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

      {/* Route picker modal */}
      <Modal visible={showPicker} animationType="slide" transparent onRequestClose={() => setShowPicker(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Route</Text>
              <Pressable onPress={() => setShowPicker(false)} hitSlop={12}>
                <Text style={s.modalClose}>Done</Text>
              </Pressable>
            </View>
            <FlatList
              data={routes}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[s.routeItem, item.id === routeId && s.routeItemActive]}
                  onPress={() => {
                    setRouteId(item.id);
                    setRouteName(item.name);
                    setShowPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[s.routeName, item.id === routeId && s.routeNameActive]}>{item.name}</Text>
                  <Text style={s.routeSub}>{item.origin} → {item.destination}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={s.noRoutes}>No routes available. Check your connection.</Text>
              }
              ItemSeparatorComponent={() => <View style={s.sep} />}
            />
          </View>
        </View>
      </Modal>
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
  helloSub: { fontSize: 15, color: '#64748B', marginBottom: 20 },
  section: { fontSize: 13, fontWeight: '600' as const, color: '#94A3B8', textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  errBox: { backgroundColor: '#FFEBEE', borderRadius: 12, padding: 14, marginBottom: 18, borderLeftWidth: 4, borderLeftColor: '#C62828' },
  errTxt: { fontSize: 14, color: '#C62828', fontWeight: '500' as const, lineHeight: 20 },
  fields: { gap: 12, marginBottom: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', height: 56, paddingHorizontal: 4 },
  pickerRow: { paddingRight: 0 },
  ic: { width: 44, justifyContent: 'center', alignItems: 'center' },
  pre: { fontSize: 16, color: '#2D3E40', fontWeight: '500' as const, marginRight: 6 },
  inp: { flex: 1, fontSize: 16, color: '#2D3E40', height: '100%', paddingRight: 16 },
  placeholder: { color: '#94A3B8' },
  passInp: { paddingRight: 48 },
  eye: { position: 'absolute', right: 16 },
  btn: { height: 54, borderRadius: 14, backgroundColor: '#1565C0', justifyContent: 'center', alignItems: 'center', shadowColor: '#1565C0', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  btnP: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  btnD: { opacity: 0.5 },
  btnT: { fontSize: 17, fontWeight: '700' as const, color: '#FFF', letterSpacing: 0.3 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, paddingBottom: 16 },
  footerTxt: { fontSize: 15, color: '#64748B' },
  footerLink: { fontSize: 15, color: '#1565C0', fontWeight: '700' as const },
  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#FFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%', paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: '#2D3E40' },
  modalClose: { fontSize: 16, color: '#1565C0', fontWeight: '600' as const },
  routeItem: { paddingHorizontal: 20, paddingVertical: 16 },
  routeItemActive: { backgroundColor: '#EFF6FF' },
  routeName: { fontSize: 16, fontWeight: '600' as const, color: '#2D3E40', marginBottom: 2 },
  routeNameActive: { color: '#1565C0' },
  routeSub: { fontSize: 13, color: '#94A3B8' },
  sep: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 20 },
  noRoutes: { padding: 24, textAlign: 'center' as const, color: '#94A3B8', fontSize: 15 },
});
