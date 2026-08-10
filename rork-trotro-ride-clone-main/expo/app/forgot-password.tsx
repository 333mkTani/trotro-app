import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { ArrowLeft, KeyRound } from 'lucide-react-native';
import { api } from '@/services/api';
import { isValidGhPhone, toE164Gh } from '@/contexts/AuthContext';
import { useTheme, type ThemePalette } from '@/contexts/ThemeContext';

type Step = 'phone' | 'code' | 'password';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
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
        if (!isValidGhPhone(phone)) throw new Error('Enter a valid Ghana phone number.');
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
        Alert.alert('Password reset', 'You can now sign in with your new password.', [
          { text: 'Sign in', onPress: () => router.replace('/login') },
        ]);
      }
    } catch (error) {
      Alert.alert('Could not reset password', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.back} onPress={() => router.back()}><ArrowLeft size={21} color={colors.white} /></TouchableOpacity>
        <View style={styles.hero}><KeyRound size={34} color={colors.white} /><Text style={styles.title}>Reset password</Text><Text style={styles.subtitle}>Verify your registered phone number before choosing a new password.</Text></View>
        <View style={styles.card}>
          {step === 'phone' && <><Text style={styles.label}>Registered phone number</Text><TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="024 123 4567" placeholderTextColor={colors.gray400} /></>}
          {step === 'code' && <><Text style={styles.label}>Verification code</Text><Text style={styles.help}>Enter the SMS code sent to {toE164Gh(phone)}.</Text><TextInput style={styles.input} value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="123456" placeholderTextColor={colors.gray400} maxLength={6} /></>}
          {step === 'password' && <><Text style={styles.label}>New password</Text><TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" placeholderTextColor={colors.gray400} /><Text style={[styles.label, { marginTop: 14 }]}>Confirm new password</Text><TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry placeholder="Repeat password" placeholderTextColor={colors.gray400} /></>}
          <TouchableOpacity style={[styles.button, busy && styles.disabled]} disabled={busy} onPress={submit}>{busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.buttonText}>{step === 'phone' ? 'Send verification code' : step === 'code' ? 'Verify code' : 'Reset password'}</Text>}</TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.primary }, scroll: { flexGrow: 1, padding: 20, paddingTop: 55 },
  back: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', marginVertical: 28 }, title: { color: c.white, fontSize: 28, fontWeight: '900', marginTop: 12 }, subtitle: { color: 'rgba(255,255,255,.75)', textAlign: 'center', marginTop: 7, lineHeight: 20 },
  card: { backgroundColor: c.white, borderRadius: 22, padding: 22 }, label: { color: c.gray700, fontSize: 13, fontWeight: '700', marginBottom: 7 }, help: { color: c.gray500, fontSize: 12, marginBottom: 10 },
  input: { height: 54, borderWidth: 1, borderColor: c.gray200, backgroundColor: c.gray50, borderRadius: 13, paddingHorizontal: 14, color: c.gray800, fontSize: 16 },
  button: { height: 54, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', marginTop: 22 }, disabled: { opacity: .6 }, buttonText: { color: c.white, fontWeight: '800', fontSize: 15 },
});
