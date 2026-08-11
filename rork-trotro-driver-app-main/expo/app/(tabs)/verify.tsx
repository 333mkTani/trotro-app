import React, { useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, Platform, Modal, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, CheckCircle, XCircle, ScanLine, RefreshCw, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { verifyBoardingCode } from '@/services/driverApi';
import { CodeInputCells } from '@/components/CodeInputCell';
import { VerificationResult } from '@/types';
import { formatTime } from '@/utils/helpers';
import { invalidateScheduledRideQueries } from '@/utils/futureRequestState';
import { parseBoardingQrPayload } from '@/utils/boardingQrPayload';

const ET: Record<string, string> = { CODE_NOT_FOUND: 'Code Not Found', CODE_EXPIRED: 'Code Has Expired', CODE_ALREADY_USED: 'Code Already Used', BUS_MISMATCH: 'Wrong Bus', CODE_INVALIDATED: 'Code Cancelled', BOARDING_NOT_OPEN: 'Boarding Not Open', WRONG_DRIVER: 'Wrong Driver' };
const EM: Record<string, string> = { CODE_NOT_FOUND: 'Not found in the system.', CODE_EXPIRED: 'This code has expired.', CODE_ALREADY_USED: 'Already used for boarding.', BUS_MISMATCH: 'Issued for a different bus.', CODE_INVALIDATED: 'Cancelled by the passenger.', BOARDING_NOT_OPEN: 'This scheduled boarding window is not open yet.', WRONG_DRIVER: 'This scheduled seat is assigned to another driver.' };

export default function TrotroPassengerVerify() {
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '']);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const qc = useQueryClient();
  const vMut = useMutation({
    mutationFn: (c: string) => verifyBoardingCode(c),
    onSuccess: async (d: VerificationResult) => {
      setResult(d);
      if (Platform.OS !== 'web') Haptics.notificationAsync(d.success ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
      if (d.success) {
        // Redemption is authoritative and idempotent on the backend. Never
        // decrement the local store here: replaying a successful response
        // must not consume the same seat twice in the driver's UI.
        await invalidateScheduledRideQueries(qc);
      }
    },
    onError: () => setResult({ success: false, error_code: 'CODE_NOT_FOUND' }),
  });
  const onVerify = useCallback(() => { const c = code.join(''); if (c.length === 6) vMut.mutate(c); }, [code, vMut]);
  const onReset = useCallback(() => { setCode(['', '', '', '', '', '']); setResult(null); vMut.reset(); }, [vMut]);
  const filled = code.every((c) => c.length === 1);

  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);

  const openScanner = useCallback(async () => {
    if (Platform.OS === 'web') { Alert.alert('Not available', 'QR scanning is only available in the mobile app.'); return; }
    let granted = permission?.granted ?? false;
    if (!granted) { const res = await requestPermission(); granted = res.granted; }
    if (!granted) { Alert.alert('Camera permission needed', 'Enable camera access in Settings to scan boarding QR codes.'); return; }
    scanLock.current = false;
    setScanning(true);
  }, [permission, requestPermission]);

  const onBarcodeScanned = useCallback((res: BarcodeScanningResult) => {
    if (scanLock.current) return;
    const boardingCode = parseBoardingQrPayload(res.data);
    if (!boardingCode) return; // ignore unrelated QR codes and keep scanning
    scanLock.current = true;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setScanning(false);
    setResult(null);
    vMut.reset();
    setCode(boardingCode.split(''));
    vMut.mutate(boardingCode);
  }, [vMut]);

  return (
    <ScrollView style={vs.c} contentContainerStyle={vs.s} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={vs.instrCard}><View style={vs.instrI}><ShieldCheck size={28} color={Colors.primary} /></View><Text style={vs.instrT}>Enter passenger&apos;s 6-digit boarding code</Text><Text style={vs.instrS}>Ask the passenger to show their code screen</Text></View>
      <View style={vs.codeW}><CodeInputCells code={code} onCodeChange={setCode} /></View>
      <Pressable style={({ pressed }) => [vs.scanBtn, pressed && { opacity: 0.6 }]} onPress={openScanner} testID="scan-qr"><ScanLine size={18} color={Colors.primary} /><Text style={vs.scanT}>Scan QR Code instead</Text></Pressable>
      {!result && <Pressable style={({ pressed }) => [vs.vBtn, pressed && vs.vBtnP, !filled && vs.vBtnD]} onPress={onVerify} disabled={!filled || vMut.isPending} testID="verify-btn">{vMut.isPending ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={vs.vBtnT}>Verify Passenger</Text>}</Pressable>}
      {result?.success && <View style={vs.okCard} testID="verify-ok"><CheckCircle size={48} color={Colors.success} /><Text style={vs.okT}>Boarding Confirmed</Text>{result.passenger_name && <Text style={vs.det}>{result.passenger_name}</Text>}{result.route_name && <Text style={vs.route}>{result.route_name}</Text>}{result.confirmed_at && <Text style={vs.time}>Confirmed at {formatTime(result.confirmed_at)}</Text>}{result.payment_status === 'balance_pending' && <View style={vs.balanceDue}><Text style={vs.balanceDueLabel}>Passenger balance due</Text><Text style={vs.balanceDueAmount}>GH₵ {(result.remaining_balance ?? 0).toFixed(2)}</Text><Text style={vs.balanceDueHint}>The passenger must complete payment securely in their app.</Text></View>}<View style={vs.seatUpdate}><RefreshCw size={12} color={Colors.primary} /><Text style={vs.seatUpdateText}>Seat count refreshed from server</Text></View><Pressable style={({ pressed }) => [vs.resetBtn, pressed && { opacity: 0.85 }]} onPress={onReset} testID="verify-another"><Text style={vs.resetT}>Verify Another</Text></Pressable></View>}
      {result && !result.success && <View style={vs.failCard} testID="verify-fail"><XCircle size={48} color={Colors.error} /><Text style={vs.failT}>{result.error_code ? ET[result.error_code] ?? 'Failed' : 'Failed'}</Text><Text style={vs.failM}>{result.error_code ? EM[result.error_code] ?? 'Try again.' : 'Try again.'}</Text><Pressable style={({ pressed }) => [vs.retryBtn, pressed && { opacity: 0.85 }]} onPress={onReset} testID="try-again"><Text style={vs.retryT}>Try Again</Text></Pressable></View>}

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)} statusBarTranslucent>
        <View style={vs.scanModal}>
          {scanning && (
            <CameraView style={vs.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onBarcodeScanned} />
          )}
          <View style={vs.scanOverlay} pointerEvents="box-none">
            <View style={vs.scanHeader}>
              <Text style={vs.scanTitle}>Scan boarding QR</Text>
              <Pressable style={vs.scanClose} onPress={() => setScanning(false)} hitSlop={12} testID="scan-close"><X size={24} color={Colors.white} /></Pressable>
            </View>
            <View style={vs.scanFrame} />
            <Text style={vs.scanHint}>Point the camera at the passenger&apos;s QR code</Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const vs = StyleSheet.create({
  c: { flex: 1, backgroundColor: Colors.background }, s: { padding: 16, paddingBottom: 40 },
  instrCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: Colors.borderLight },
  instrI: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EBF4FF', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  instrT: { fontSize: 17, fontWeight: '700' as const, color: Colors.textPrimary, textAlign: 'center', marginBottom: 6 }, instrS: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },
  codeW: { marginBottom: 20 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, marginBottom: 24 }, scanT: { fontSize: 15, fontWeight: '600' as const, color: Colors.primary },
  vBtn: { height: 54, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  vBtnP: { opacity: 0.85, transform: [{ scale: 0.98 }] }, vBtnD: { opacity: 0.4 }, vBtnT: { fontSize: 17, fontWeight: '700' as const, color: Colors.white },
  okCard: { backgroundColor: '#E8F5E9', borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#C8E6C9' },
  okT: { fontSize: 22, fontWeight: '800' as const, color: Colors.success, marginTop: 12, marginBottom: 8 },
  det: { fontSize: 16, fontWeight: '600' as const, color: Colors.textPrimary, marginBottom: 4 }, route: { fontSize: 14, color: Colors.textSecondary, marginBottom: 4 }, time: { fontSize: 13, color: Colors.textSecondary, marginBottom: 20 },
  resetBtn: { height: 48, borderRadius: 12, backgroundColor: Colors.success, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }, resetT: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
  failCard: { backgroundColor: '#FFEBEE', borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: '#FFCDD2' },
  failT: { fontSize: 20, fontWeight: '800' as const, color: Colors.error, marginTop: 12, marginBottom: 8 }, failM: { fontSize: 14, color: Colors.textPrimary, textAlign: 'center', lineHeight: 20, marginBottom: 20, maxWidth: 280 },
  retryBtn: { height: 48, borderRadius: 12, backgroundColor: Colors.error, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 28 }, retryT: { fontSize: 15, fontWeight: '600' as const, color: Colors.white },
  seatUpdate: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EBF4FF', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, marginBottom: 16 },
  seatUpdateText: { fontSize: 12, fontWeight: '600' as const, color: Colors.primary },
  balanceDue: { width: '100%', backgroundColor: '#FFF3E8', borderRadius: 12, borderWidth: 1, borderColor: '#FFD1A8', padding: 14, alignItems: 'center', marginBottom: 16 },
  balanceDueLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.textSecondary },
  balanceDueAmount: { fontSize: 22, fontWeight: '800' as const, color: Colors.primary, marginVertical: 4 },
  balanceDueHint: { fontSize: 12, color: Colors.textSecondary, textAlign: 'center', lineHeight: 17 },
  scanModal: { flex: 1, backgroundColor: '#000' },
  camera: { ...StyleSheet.absoluteFillObject },
  scanOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  scanHeader: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16 },
  scanTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.white },
  scanClose: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  scanFrame: { width: 240, height: 240, borderRadius: 24, borderWidth: 3, borderColor: Colors.white, backgroundColor: 'transparent' },
  scanHint: { position: 'absolute', bottom: 80, fontSize: 15, fontWeight: '600' as const, color: Colors.white, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, overflow: 'hidden' },
});
