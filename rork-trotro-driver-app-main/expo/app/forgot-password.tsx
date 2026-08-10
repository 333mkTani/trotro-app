import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { ArrowLeft, KeyRound } from 'lucide-react-native';
import api from '@/services/api';
import { toE164Gh } from '@/services/auth';

type Step = 'phone' | 'code' | 'password';

export default function ForgotPasswordScreen() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmation, setConfirmation] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null);
  const [idToken, setIdToken] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      if (step === 'phone') {
        if (!/^\+233[25]\d{8}$/.test(toE164Gh(phone))) throw new Error('Enter a valid Ghana phone number.');
        setConfirmation(await auth().signInWithPhoneNumber(toE164Gh(phone)));
        setStep('code');
      } else if (step === 'code') {
        if (!confirmation || code.length !== 6) throw new Error('Enter the six-digit verification code.');
        const result = await confirmation.confirm(code);
        const token = await result?.user.getIdToken();
        if (!token) throw new Error('Phone verification failed. Request a new code.');
        setIdToken(token);
        setStep('password');
      } else {
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password !== confirmPassword) throw new Error('Passwords do not match.');
        await api.post('/auth/reset-password', { idToken, newPassword: password });
        await auth().signOut().catch(() => undefined);
        Alert.alert('Password reset', 'You can now sign in with your new password.', [{ text: 'Sign in', onPress: () => router.replace('/') }]);
      }
    } catch (error) {
      Alert.alert('Could not reset password', error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(false); }
  };

  return <View style={s.root}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
    <Pressable style={s.back} onPress={() => router.back()}><ArrowLeft size={21} color="#FFF" /></Pressable>
    <View style={s.hero}><KeyRound size={34} color="#FFF" /><Text style={s.title}>Reset password</Text><Text style={s.subtitle}>Verify your registered driver phone number first.</Text></View>
    <View style={s.card}>
      {step === 'phone' && <><Text style={s.label}>Registered phone number</Text><TextInput style={s.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="024 123 4567" /></>}
      {step === 'code' && <><Text style={s.label}>Verification code</Text><Text style={s.help}>Enter the SMS code sent to {toE164Gh(phone)}.</Text><TextInput style={s.input} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="123456" maxLength={6} /></>}
      {step === 'password' && <><Text style={s.label}>New password</Text><TextInput style={s.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" /><Text style={[s.label, { marginTop: 14 }]}>Confirm new password</Text><TextInput style={s.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Repeat password" /></>}
      <Pressable style={[s.button, busy && { opacity: .6 }]} disabled={busy} onPress={submit}>{busy ? <ActivityIndicator color="#FFF" /> : <Text style={s.buttonText}>{step === 'phone' ? 'Send verification code' : step === 'code' ? 'Verify code' : 'Reset password'}</Text>}</Pressable>
    </View>
  </ScrollView></KeyboardAvoidingView></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1565C0' }, scroll: { flexGrow: 1, padding: 20, paddingTop: 55 }, back: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', marginVertical: 28 }, title: { color: '#FFF', fontSize: 28, fontWeight: '900', marginTop: 12 }, subtitle: { color: 'rgba(255,255,255,.75)', textAlign: 'center', marginTop: 7 },
  card: { backgroundColor: '#FFF', borderRadius: 22, padding: 22 }, label: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 7 }, help: { color: '#64748B', fontSize: 12, marginBottom: 10 },
  input: { height: 54, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', borderRadius: 13, paddingHorizontal: 14, color: '#1E293B', fontSize: 16 }, button: { height: 54, borderRadius: 14, backgroundColor: '#1565C0', alignItems: 'center', justifyContent: 'center', marginTop: 22 }, buttonText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
});
