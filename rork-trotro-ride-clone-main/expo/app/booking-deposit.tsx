import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Banknote, Bus, CheckCircle, Clock, LockKeyhole, MapPin, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import QRCode from '@/components/QRCode';
import { useTheme, type ThemePalette } from '@/contexts/ThemeContext';
import { api } from '@/services/api';
import { payBookingDeposit, type DepositVerificationResult } from '@/services/bookingPayment';
import { createPaymentAttemptKey } from '@/utils/paymentIdempotency';

const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value ?? '';
const money = (value: string) => Number(value || 0).toFixed(2);

export default function BookingDepositScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const st = React.useMemo(() => styles(colors), [colors]);
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const bookingId = one(params.bookingId);
  const holdExpiresAt = one(params.holdExpiresAt);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [result, setResult] = useState<DepositVerificationResult | null>(null);
  const attemptKey = useRef(createPaymentAttemptKey(bookingId));

  useEffect(() => {
    const update = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(holdExpiresAt).getTime() - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [holdExpiresAt]);

  const onPay = useCallback(async () => {
    if (!bookingId || secondsLeft <= 0 || paying) return;
    setPaying(true);
    try {
      const verified = await payBookingDeposit(bookingId, attemptKey.current);
      setResult(verified);
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      if (verified.reserved) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      attemptKey.current = createPaymentAttemptKey(bookingId);
      Alert.alert(
        'Payment not confirmed',
        error instanceof Error ? error.message : 'No charge was confirmed. You can safely try again.',
      );
    } finally {
      setPaying(false);
    }
  }, [bookingId, paying, queryClient, secondsLeft]);

  const onCancel = useCallback(async () => {
    if (!bookingId || cancelling) return;
    setCancelling(true);
    try {
      await api.post(`/bookings/${bookingId}/cancel`);
      await queryClient.invalidateQueries({ queryKey: ['bookings'] });
      router.back();
    } catch (error) {
      Alert.alert('Could not cancel hold', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setCancelling(false);
    }
  }, [bookingId, cancelling, queryClient, router]);

  if (result?.reserved && result.booking) {
    const code = result.code?.code;
    return (
      <ScrollView contentContainerStyle={st.successPage}>
        <Stack.Screen options={{ title: 'Seat Reserved' }} />
        <View style={st.successIcon}><CheckCircle size={54} color={colors.white} /></View>
        <Text style={st.successTitle}>Seat reserved</Text>
        <Text style={st.successText}>Your deposit was verified and one seat has been reserved on the bus.</Text>
        {code ? (
          <View style={st.qrCard}>
            <Text style={st.eyebrow}>BOARDING CODE</Text>
            <Text style={st.code}>{code}</Text>
            <QRCode value={result.code?.qr_payload || code} size={170} backgroundColor="#FFFFFF" />
            <Text style={st.qrHint}>Show this QR code or six-digit code to the driver.</Text>
          </View>
        ) : null}
        <View style={st.summaryCard}>
          <SummaryRow label="Deposit paid" value={`GH₵ ${money(one(params.depositAmount))}`} />
          <SummaryRow label="Balance after boarding" value={`GH₵ ${money(one(params.remainingBalance))}`} />
        </View>
        <TouchableOpacity style={st.primaryButton} onPress={() => router.replace('/(tabs)/rides')}>
          <Text style={st.primaryButtonText}>View My Rides</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  if (result?.refundPending) {
    return (
      <View style={st.centerPage}>
        <TriangleAlert size={58} color={colors.warning} />
        <Text style={st.refundTitle}>Refund pending</Text>
        <Text style={st.refundText}>Your deposit was received, but the bus became unavailable before the seat could be reserved. You have not been given a false confirmation. Your refund will be processed.</Text>
        <TouchableOpacity style={st.primaryButton} onPress={() => router.replace('/(tabs)/rides')}>
          <Text style={st.primaryButtonText}>View booking status</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const expired = secondsLeft <= 0;

  return (
    <View style={st.root}>
      <ScrollView contentContainerStyle={st.content} showsVerticalScrollIndicator={false}>
        <View style={st.holdBanner}>
          <Clock size={18} color={expired ? colors.danger : colors.primary} />
          <View style={st.holdCopy}>
            <Text style={st.holdTitle}>{expired ? 'Seat hold expired' : 'Seat temporarily held'}</Text>
            <Text style={st.holdText}>{expired ? 'Return to the route results and choose an available bus.' : `Complete the deposit within ${minutes}:${String(seconds).padStart(2, '0')}.`}</Text>
          </View>
        </View>

        <View style={st.tripCard}>
          <View style={st.tripHeading}><Bus size={20} color={colors.primary} /><Text style={st.tripTitle}>{one(params.busRegistration)}</Text></View>
          <Text style={st.driver}>{one(params.driverName)}</Text>
          <Text style={st.route}>{one(params.routeName)}</Text>
          <View style={st.stopRow}><MapPin size={15} color={colors.primary} /><Text style={st.stopText}>{one(params.pickupStop)}</Text></View>
          <View style={st.stopRow}><MapPin size={15} color={colors.success} /><Text style={st.stopText}>{one(params.destinationStop)}</Text></View>
        </View>

        <View style={st.paymentCard}>
          <Text style={st.sectionTitle}>Payment breakdown</Text>
          <SummaryRow label="Total fare" value={`GH₵ ${money(one(params.totalFare))}`} />
          <SummaryRow label="Commitment deposit now" value={`GH₵ ${money(one(params.depositAmount))}`} strong />
          <View style={st.divider} />
          <SummaryRow label="Balance after boarding" value={`GH₵ ${money(one(params.remainingBalance))}`} />
          <View style={st.infoRow}><Banknote size={16} color={colors.success} /><Text style={st.infoText}>The deposit is included in the fare; it is not an additional charge.</Text></View>
          <View style={st.infoRow}><ShieldCheck size={16} color={colors.info} /><Text style={st.infoText}>Your seat is confirmed only after the backend verifies payment and reserves capacity.</Text></View>
          <View style={st.infoRow}><LockKeyhole size={16} color={colors.gray500} /><Text style={st.infoText}>Paystack securely handles Mobile Money and card details.</Text></View>
        </View>
      </ScrollView>

      <View style={st.footer}>
        <TouchableOpacity style={[st.primaryButton, expired && st.disabled]} disabled={expired || paying} onPress={onPay}>
          {paying ? <ActivityIndicator color={colors.white} /> : <Text style={st.primaryButtonText}>{expired ? 'Hold expired' : `Pay GH₵ ${money(one(params.depositAmount))} deposit`}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={st.cancelButton} disabled={paying || cancelling} onPress={onCancel}>
          {cancelling ? <ActivityIndicator color={colors.gray500} /> : <Text style={st.cancelText}>Cancel seat hold</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={base.row}><Text style={[base.rowLabel, strong && base.strong]}>{label}</Text><Text style={[base.rowValue, strong && base.strong]}>{value}</Text></View>;
}

const base = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 8 },
  rowLabel: { flex: 1, color: '#64748B', fontSize: 14 },
  rowValue: { color: '#0F172A', fontSize: 14, fontWeight: '600' },
  strong: { fontWeight: '800', color: '#0F172A' },
});

const styles = (c: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.screenBg },
  content: { padding: 16, paddingBottom: 190, gap: 14 },
  centerPage: { flex: 1, backgroundColor: c.screenBg, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 },
  holdBanner: { flexDirection: 'row', gap: 12, padding: 15, borderRadius: 16, backgroundColor: c.primaryFaded, alignItems: 'center' },
  holdCopy: { flex: 1 },
  holdTitle: { color: c.text, fontWeight: '800', fontSize: 15 },
  holdText: { color: c.gray600, fontSize: 13, marginTop: 3 },
  tripCard: { backgroundColor: c.white, borderRadius: 18, padding: 18, gap: 8 },
  tripHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  tripTitle: { color: c.text, fontSize: 19, fontWeight: '800' },
  driver: { color: c.gray600, fontSize: 14 },
  route: { color: c.primary, fontSize: 13, fontWeight: '700', marginBottom: 5 },
  stopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stopText: { color: c.gray700, fontSize: 14, flex: 1 },
  paymentCard: { backgroundColor: c.white, borderRadius: 18, padding: 18 },
  sectionTitle: { color: c.text, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  divider: { height: 1, backgroundColor: c.gray100, marginVertical: 5 },
  infoRow: { flexDirection: 'row', gap: 9, marginTop: 12, alignItems: 'flex-start' },
  infoText: { color: c.gray600, fontSize: 12.5, lineHeight: 18, flex: 1 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: c.screenBg, padding: 16, gap: 8, borderTopWidth: 1, borderTopColor: c.gray100 },
  primaryButton: { backgroundColor: c.primary, borderRadius: 15, paddingVertical: 16, paddingHorizontal: 22, alignItems: 'center', minWidth: 220 },
  primaryButtonText: { color: c.white, fontSize: 16, fontWeight: '800' },
  disabled: { backgroundColor: c.gray300 },
  cancelButton: { paddingVertical: 10, alignItems: 'center' },
  cancelText: { color: c.gray500, fontWeight: '600' },
  successPage: { flexGrow: 1, alignItems: 'center', backgroundColor: c.screenBg, padding: 22, gap: 14 },
  successIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: c.success, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  successTitle: { color: c.text, fontSize: 27, fontWeight: '900' },
  successText: { color: c.gray600, textAlign: 'center', lineHeight: 21, maxWidth: 360 },
  qrCard: { width: '100%', backgroundColor: c.white, borderRadius: 20, padding: 20, alignItems: 'center', gap: 12 },
  eyebrow: { color: c.gray500, fontWeight: '800', fontSize: 11, letterSpacing: 1.2 },
  code: { color: c.text, fontSize: 30, fontWeight: '900', letterSpacing: 7 },
  qrHint: { color: c.gray500, fontSize: 12, textAlign: 'center' },
  summaryCard: { width: '100%', backgroundColor: c.white, borderRadius: 18, padding: 17 },
  refundTitle: { color: c.text, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  refundText: { color: c.gray600, lineHeight: 21, textAlign: 'center', maxWidth: 380 },
});
