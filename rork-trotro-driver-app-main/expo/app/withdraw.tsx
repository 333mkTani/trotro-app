import React, { useState, useCallback, useRef, useEffect } from 'react';
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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowUpRight,
  Smartphone,
  Building2,
  Check,
  ChevronDown,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { getWalletBalance, requestWithdrawal } from '@/services/driverApi';

type WithdrawMethod = 'MOBILE_MONEY' | 'BANK_TRANSFER';

interface MoMoProvider {
  id: string;
  name: string;
  color: string;
}

const MOMO_PROVIDERS: MoMoProvider[] = [
  { id: 'mtn', name: 'MTN MoMo', color: '#FFCC00' },
  { id: 'vodafone', name: 'Vodafone Cash', color: '#E60000' },
  { id: 'airteltigo', name: 'AirtelTigo Money', color: '#FF0000' },
];

const QUICK_AMOUNTS = [50, 100, 200, 500];

export default function WithdrawScreen() {
  const qc = useQueryClient();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const balanceQ = useQuery({
    queryKey: ['wallet-balance'],
    queryFn: getWalletBalance,
  });

  const [method, setMethod] = useState<WithdrawMethod>('MOBILE_MONEY');
  const [amount, setAmount] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [accountName, setAccountName] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<string>('mtn');
  const [showProviders, setShowProviders] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const withdrawMut = useMutation({
    mutationFn: () => {
      const provider = MOMO_PROVIDERS.find(p => p.id === selectedProvider);
      return requestWithdrawal(
        parseFloat(amount),
        method,
        accountNumber,
        accountName,
        provider?.name
      );
    },
    onSuccess: () => {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      qc.invalidateQueries({ queryKey: ['wallet-balance'] });
      qc.invalidateQueries({ queryKey: ['wallet-transactions'] });
      setShowSuccess(true);
      Animated.parallel([
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    },
    onError: (err: Error) => {
      Alert.alert('Withdrawal Failed', err.message || 'Something went wrong. Please try again.');
    },
  });

  const parsedAmount = parseFloat(amount) || 0;
  const availableBalance = balanceQ.data?.available ?? 0;
  const isValid = parsedAmount >= 5 && parsedAmount <= availableBalance && accountNumber.length >= 6 && accountName.length >= 2;

  const handleQuickAmount = useCallback((val: number) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setAmount(val.toString());
  }, []);

  const handleWithdraw = useCallback(() => {
    if (!isValid) return;
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    Alert.alert(
      'Confirm Withdrawal',
      `Withdraw GHS ${parsedAmount.toFixed(2)} to ${method === 'MOBILE_MONEY' ? MOMO_PROVIDERS.find(p => p.id === selectedProvider)?.name : 'Bank Account'} (${accountNumber})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Withdraw', onPress: () => withdrawMut.mutate(), style: 'destructive' },
      ]
    );
  }, [isValid, parsedAmount, method, selectedProvider, accountNumber, withdrawMut]);

  const handleDone = useCallback(() => {
    router.back();
  }, []);

  const currentProvider = MOMO_PROVIDERS.find(p => p.id === selectedProvider);

  if (showSuccess) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Withdrawal', headerShown: true }} />
        <Animated.View style={[styles.successContainer, {
          opacity: successOpacity,
          transform: [{ scale: successScale }],
        }]}>
          <View style={styles.successCircle}>
            <Check size={40} color="#FFFFFF" />
          </View>
          <Text style={styles.successTitle}>Withdrawal Submitted</Text>
          <Text style={styles.successAmount}>GHS {parsedAmount.toFixed(2)}</Text>
          <Text style={styles.successDesc}>
            Your withdrawal to {currentProvider?.name ?? 'your account'} ending in {accountNumber.slice(-4)} is being processed.
          </Text>
          <Text style={styles.successNote}>Funds typically arrive within 1-5 minutes</Text>
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
      <Stack.Screen options={{ title: 'Withdraw Funds', headerShown: true }} />
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
          <View style={styles.availableCard}>
            <Text style={styles.availableLabel}>Available to Withdraw</Text>
            <Text style={styles.availableAmount}>GHS {availableBalance.toFixed(2)}</Text>
          </View>

          <Text style={styles.fieldLabel}>Withdrawal Method</Text>
          <View style={styles.methodRow}>
            <Pressable
              style={[styles.methodCard, method === 'MOBILE_MONEY' && styles.methodActive]}
              onPress={() => setMethod('MOBILE_MONEY')}
              testID="method-momo"
            >
              <Smartphone size={22} color={method === 'MOBILE_MONEY' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.methodText, method === 'MOBILE_MONEY' && styles.methodTextActive]}>
                Mobile Money
              </Text>
              {method === 'MOBILE_MONEY' && (
                <View style={styles.methodCheck}>
                  <Check size={12} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
            <Pressable
              style={[styles.methodCard, method === 'BANK_TRANSFER' && styles.methodActive]}
              onPress={() => setMethod('BANK_TRANSFER')}
              testID="method-bank"
            >
              <Building2 size={22} color={method === 'BANK_TRANSFER' ? Colors.primary : Colors.textSecondary} />
              <Text style={[styles.methodText, method === 'BANK_TRANSFER' && styles.methodTextActive]}>
                Bank Transfer
              </Text>
              {method === 'BANK_TRANSFER' && (
                <View style={styles.methodCheck}>
                  <Check size={12} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          </View>

          {method === 'MOBILE_MONEY' && (
            <>
              <Text style={styles.fieldLabel}>Provider</Text>
              <Pressable
                style={styles.providerSelector}
                onPress={() => setShowProviders(!showProviders)}
                testID="provider-selector"
              >
                <View style={[styles.providerDot, { backgroundColor: currentProvider?.color }]} />
                <Text style={styles.providerName}>{currentProvider?.name}</Text>
                <ChevronDown size={18} color={Colors.textSecondary} />
              </Pressable>
              {showProviders && (
                <View style={styles.providerList}>
                  {MOMO_PROVIDERS.map((p) => (
                    <Pressable
                      key={p.id}
                      style={[styles.providerOption, p.id === selectedProvider && styles.providerOptionActive]}
                      onPress={() => { setSelectedProvider(p.id); setShowProviders(false); }}
                      testID={`provider-${p.id}`}
                    >
                      <View style={[styles.providerDot, { backgroundColor: p.color }]} />
                      <Text style={styles.providerOptionText}>{p.name}</Text>
                      {p.id === selectedProvider && <Check size={16} color={Colors.primary} />}
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}

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
              testID="amount-input"
            />
          </View>
          {parsedAmount > 0 && parsedAmount < 5 && (
            <Text style={styles.errorHint}>Minimum withdrawal is GHS 5.00</Text>
          )}
          {parsedAmount > availableBalance && (
            <Text style={styles.errorHint}>Insufficient balance</Text>
          )}

          <View style={styles.quickAmounts}>
            {QUICK_AMOUNTS.map((val) => (
              <Pressable
                key={val}
                style={[styles.quickBtn, parsedAmount === val && styles.quickBtnActive]}
                onPress={() => handleQuickAmount(val)}
                testID={`quick-${val}`}
              >
                <Text style={[styles.quickBtnText, parsedAmount === val && styles.quickBtnTextActive]}>
                  {val}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.quickBtn, parsedAmount === availableBalance && styles.quickBtnActive]}
              onPress={() => handleQuickAmount(availableBalance)}
              testID="quick-max"
            >
              <Text style={[styles.quickBtnText, parsedAmount === availableBalance && styles.quickBtnTextActive]}>
                Max
              </Text>
            </Pressable>
          </View>

          <Text style={styles.fieldLabel}>
            {method === 'MOBILE_MONEY' ? 'Phone Number' : 'Account Number'}
          </Text>
          <TextInput
            style={styles.textInput}
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder={method === 'MOBILE_MONEY' ? '024 XXX XXXX' : 'Enter account number'}
            placeholderTextColor={Colors.disabled}
            keyboardType="number-pad"
            testID="account-number-input"
          />

          <Text style={styles.fieldLabel}>Account Name</Text>
          <TextInput
            style={styles.textInput}
            value={accountName}
            onChangeText={setAccountName}
            placeholder="Name on account"
            placeholderTextColor={Colors.disabled}
            testID="account-name-input"
          />

          <Pressable
            style={[styles.submitBtn, !isValid && styles.submitBtnDisabled]}
            onPress={handleWithdraw}
            disabled={!isValid || withdrawMut.isPending}
            testID="submit-withdraw"
          >
            {withdrawMut.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <ArrowUpRight size={20} color="#FFFFFF" />
                <Text style={styles.submitBtnText}>
                  Withdraw {parsedAmount > 0 ? `GHS ${parsedAmount.toFixed(2)}` : ''}
                </Text>
              </>
            )}
          </Pressable>
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
  availableCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  availableLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  availableAmount: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    marginBottom: 8,
    marginTop: 4,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  methodCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: Colors.borderLight,
  },
  methodActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },
  methodText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
  methodTextActive: {
    color: Colors.primary,
  },
  methodCheck: {
    position: 'absolute' as const,
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 8,
  },
  providerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    flex: 1,
  },
  providerList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 8,
    overflow: 'hidden',
  },
  providerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  providerOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  providerOptionText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
    flex: 1,
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
    marginTop: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  quickBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  quickBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  quickBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  quickBtnTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: 16,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: Colors.disabled,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
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
    color: Colors.primary,
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
    backgroundColor: Colors.primary,
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
