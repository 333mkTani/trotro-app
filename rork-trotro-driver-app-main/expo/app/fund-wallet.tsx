import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  CreditCard,
  Shield,
  Check,
  Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { fundWallet } from '@/services/driverApi';

const QUICK_AMOUNTS = [20, 50, 100, 200, 500];

export default function FundWalletScreen() {
  const qc = useQueryClient();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(cardScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, cardScale]);

  const [amount, setAmount] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);
  const [fundedAmount, setFundedAmount] = useState<number>(0);

  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const parsedAmount = parseFloat(amount) || 0;
  const isValid = parsedAmount >= 1;
  const fee = useMemo(() => {
    if (parsedAmount <= 0) return 0;
    const paystackFee = parsedAmount * 0.0195;
    return Math.min(paystackFee, 100);
  }, [parsedAmount]);
  const totalCharge = parsedAmount + fee;

  const fundMut = useMutation({
    mutationFn: () => fundWallet(parsedAmount, 'PAYSTACK'),
    onSuccess: () => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      qc.invalidateQueries({ queryKey: ['wallet-balance'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
      setFundedAmount(parsedAmount);
      setShowSuccess(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    },
    onError: (err: Error) => {
      Alert.alert('Payment Failed', err.message || 'Something went wrong. Please try again.');
    },
  });

  const handleQuickAmount = useCallback((val: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setAmount(val.toString());
  }, []);

  const handlePay = useCallback(() => {
    if (!isValid) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert(
      'Confirm Payment',
      `Fund your wallet with GHS ${parsedAmount.toFixed(2)}?\n\nPaystack fee: GHS ${fee.toFixed(2)}\nTotal charge: GHS ${totalCharge.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Pay Now', onPress: () => fundMut.mutate() },
      ]
    );
  }, [isValid, parsedAmount, fee, totalCharge, fundMut]);

  const handleDone = useCallback(() => {
    router.back();
  }, []);

  if (showSuccess) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Fund Wallet', headerShown: true }} />
        <Animated.View style={[styles.successContainer, {
          opacity: successOpacity,
          transform: [{ scale: successScale }],
        }]}>
          <View style={styles.successCircle}>
            <Check size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>Payment Successful</Text>
          <Text style={styles.successAmount}>GHS {fundedAmount.toFixed(2)}</Text>
          <Text style={styles.successDesc}>
            Your wallet has been funded successfully via Paystack.
          </Text>
          <Text style={styles.successNote}>Balance updated instantly</Text>
          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && styles.doneBtnPressed]}
            onPress={handleDone}
            testID="done-btn"
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Fund Wallet', headerShown: true }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <Animated.ScrollView
          style={[styles.flex, { opacity: fadeAnim }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={[styles.heroCard, { transform: [{ scale: cardScale }] }]}>
            <View style={styles.heroIconRow}>
              <View style={styles.paystackBadge}>
                <CreditCard size={18} color="#00C3F7" />
              </View>
              <View style={styles.securityBadge}>
                <Shield size={12} color="#16A34A" />
                <Text style={styles.securityText}>Secured by Paystack</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>Fund Your Wallet</Text>
            <Text style={styles.heroSubtitle}>
              Add money instantly using mobile money, card, or bank transfer
            </Text>
          </Animated.View>

          <Text style={styles.fieldLabel}>Amount (GHS)</Text>
          <View style={styles.amountInputWrap}>
            <Text style={styles.currencyPrefix}>GHS</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              placeholderTextColor={Colors.disabled}
              keyboardType="decimal-pad"
              testID="fund-amount-input"
            />
          </View>
          {parsedAmount > 0 && parsedAmount < 1 && (
            <Text style={styles.errorHint}>Minimum amount is GHS 1.00</Text>
          )}

          <View style={styles.quickAmounts}>
            {QUICK_AMOUNTS.map((val) => (
              <Pressable
                key={val}
                style={[styles.quickBtn, parsedAmount === val && styles.quickBtnActive]}
                onPress={() => handleQuickAmount(val)}
                testID={`quick-fund-${val}`}
              >
                <Text style={[styles.quickBtnText, parsedAmount === val && styles.quickBtnTextActive]}>
                  {val}
                </Text>
              </Pressable>
            ))}
          </View>

          {parsedAmount > 0 && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount</Text>
                <Text style={styles.summaryValue}>GHS {parsedAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Paystack Fee</Text>
                <Text style={styles.summaryFee}>GHS {fee.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTotalLabel}>Total Charge</Text>
                <Text style={styles.summaryTotal}>GHS {totalCharge.toFixed(2)}</Text>
              </View>
            </View>
          )}

          <View style={styles.paymentMethods}>
            <Text style={styles.methodsTitle}>Payment Methods</Text>
            <View style={styles.methodChips}>
              <View style={styles.methodChip}>
                <Zap size={14} color="#FFCC00" />
                <Text style={styles.methodChipText}>Mobile Money</Text>
              </View>
              <View style={styles.methodChip}>
                <CreditCard size={14} color={Colors.primary} />
                <Text style={styles.methodChipText}>Card</Text>
              </View>
              <View style={styles.methodChip}>
                <CreditCard size={14} color="#7C3AED" />
                <Text style={styles.methodChipText}>Bank</Text>
              </View>
            </View>
          </View>

          <Pressable
            style={[styles.payBtn, !isValid && styles.payBtnDisabled]}
            onPress={handlePay}
            disabled={!isValid || fundMut.isPending}
            testID="pay-now-btn"
          >
            {fundMut.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <CreditCard size={20} color="#FFFFFF" />
                <Text style={styles.payBtnText}>
                  Pay with Paystack{parsedAmount > 0 ? ` · GHS ${totalCharge.toFixed(2)}` : ''}
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.trustRow}>
            <Shield size={14} color={Colors.textSecondary} />
            <Text style={styles.trustText}>
              Payments are processed securely by Paystack. Your card details are never stored.
            </Text>
          </View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#0A2540',
    borderRadius: 20,
    padding: 24,
    marginBottom: 24,
  },
  heroIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  paystackBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(0,195,247,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(22,163,74,0.15)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  securityText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#16A34A',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 4,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: 14,
    marginBottom: 4,
  },
  currencyPrefix: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    paddingVertical: 14,
  },
  errorHint: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '500' as const,
    marginTop: 4,
    marginBottom: 4,
    marginLeft: 4,
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  quickBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  quickBtnActive: {
    backgroundColor: '#0A2540',
    borderColor: '#0A2540',
  },
  quickBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  quickBtnTextActive: {
    color: '#FFFFFF',
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '600' as const,
  },
  summaryFee: {
    fontSize: 14,
    color: '#D97706',
    fontWeight: '600' as const,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '700' as const,
  },
  summaryTotal: {
    fontSize: 17,
    color: Colors.textPrimary,
    fontWeight: '800' as const,
  },
  paymentMethods: {
    marginBottom: 20,
  },
  methodsTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 10,
  },
  methodChips: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  methodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.surface,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  methodChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
  },
  payBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0A2540',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
    shadowColor: '#0A2540',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnDisabled: {
    backgroundColor: Colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  payBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 4,
  },
  trustText: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    flex: 1,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  successCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: '#16A34A',
    marginBottom: 12,
  },
  successDesc: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 8,
  },
  successNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    marginBottom: 32,
  },
  doneBtn: {
    backgroundColor: '#0A2540',
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 14,
  },
  doneBtnPressed: {
    opacity: 0.85,
  },
  doneBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
