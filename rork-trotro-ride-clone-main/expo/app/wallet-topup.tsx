import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Animated,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import {
  Smartphone,
  CreditCard,
  Building2,
  Check,
  Wallet,
  ChevronRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useWallet } from "@/contexts/WalletContext";
import { PaymentMethod } from "@/types";
const Colors = StaticColors;

interface PaymentOption {
  id: PaymentMethod;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: "momo_mtn",
    label: "MTN Mobile Money",
    sublabel: "Instant transfer",
    icon: <Smartphone size={20} color="#FFCC00" />,
    color: "#FFCC00",
    bgColor: "#FFF9E0",
  },
  {
    id: "momo_vodafone",
    label: "Vodafone Cash",
    sublabel: "Instant transfer",
    icon: <Smartphone size={20} color="#E60000" />,
    color: "#E60000",
    bgColor: "#FFE5E5",
  },
  {
    id: "momo_airteltigo",
    label: "AirtelTigo Money",
    sublabel: "Instant transfer",
    icon: <Smartphone size={20} color="#0066CC" />,
    color: "#0066CC",
    bgColor: "#E5F0FF",
  },
  {
    id: "card",
    label: "Debit / Credit Card",
    sublabel: "Visa, Mastercard",
    icon: <CreditCard size={20} color={Colors.gray600} />,
    color: Colors.gray600,
    bgColor: Colors.gray100,
  },
  {
    id: "bank",
    label: "Bank Transfer",
    sublabel: "1-2 business days",
    icon: <Building2 size={20} color={Colors.info} />,
    color: Colors.info,
    bgColor: Colors.infoLight,
  },
];

const QUICK_AMOUNTS = [10, 20, 50, 100];

export default function WalletTopUpScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const { topUp, topUpPending, balance } = useWallet();
  const [amount, setAmount] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const numericAmount = parseFloat(amount) || 0;
  const isValid = numericAmount >= 1 && selectedMethod !== null;

  const onQuickAmount = useCallback((val: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount(String(val));
  }, []);

  const onSelectMethod = useCallback((method: PaymentMethod) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMethod(method);
  }, []);

  const onTopUp = useCallback(async () => {
    if (!isValid || !selectedMethod) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await topUp({ amount: numericAmount, paymentMethod: selectedMethod });
      setShowSuccess(true);
      Animated.parallel([
        Animated.spring(successScale, {
          toValue: 1,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }),
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        router.back();
      }, 2000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Top up failed";
      Alert.alert("Error", msg);
    }
  }, [isValid, selectedMethod, numericAmount, topUp, router, successScale, successOpacity]);

  if (showSuccess) {
    return (
      <View style={st.successRoot}>
        <Stack.Screen options={{ headerShown: false }} />
        <Animated.View
          style={[
            st.successCircle,
            {
              opacity: successOpacity,
              transform: [{ scale: successScale }],
            },
          ]}
        >
          <Check size={48} color={Colors.white} />
        </Animated.View>
        <Animated.Text style={[st.successTitle, { opacity: successOpacity }]}>
          Top Up Successful!
        </Animated.Text>
        <Animated.Text style={[st.successAmount, { opacity: successOpacity }]}>
          GH₵ {numericAmount.toFixed(2)}
        </Animated.Text>
        <Animated.Text style={[st.successSub, { opacity: successOpacity }]}>
          New balance: GH₵ {(balance + numericAmount).toFixed(2)}
        </Animated.Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={st.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={st.currentBalanceWrap}>
          <View style={st.balancePill}>
            <Wallet size={14} color={Colors.primary} />
            <Text style={st.balancePillText}>
              Current balance: <Text style={st.balancePillBold}>GH₵ {balance.toFixed(2)}</Text>
            </Text>
          </View>
        </View>

        <Text style={st.sectionLabel}>AMOUNT</Text>
        <View style={st.amountCard}>
          <View style={st.inputRow}>
            <Text style={st.currency}>GH₵</Text>
            <TextInput
              style={st.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.gray300}
              maxLength={8}
              testID="amount-input"
            />
          </View>
          <View style={st.quickAmountsRow}>
            {QUICK_AMOUNTS.map((val) => (
              <TouchableOpacity
                key={val}
                style={[
                  st.quickChip,
                  numericAmount === val && st.quickChipActive,
                ]}
                onPress={() => onQuickAmount(val)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    st.quickChipText,
                    numericAmount === val && st.quickChipTextActive,
                  ]}
                >
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={st.sectionLabel}>PAYMENT METHOD</Text>
        <View style={st.methodsCard}>
          {PAYMENT_OPTIONS.map((opt, idx) => (
            <React.Fragment key={opt.id}>
              <TouchableOpacity
                style={st.methodRow}
                onPress={() => onSelectMethod(opt.id)}
                activeOpacity={0.6}
                testID={`method-${opt.id}`}
              >
                <View style={st.methodLeft}>
                  <View style={[st.methodIcon, { backgroundColor: opt.bgColor }]}>
                    {opt.icon}
                  </View>
                  <View>
                    <Text style={st.methodLabel}>{opt.label}</Text>
                    <Text style={st.methodSub}>{opt.sublabel}</Text>
                  </View>
                </View>
                <View
                  style={[
                    st.radio,
                    selectedMethod === opt.id && st.radioActive,
                  ]}
                >
                  {selectedMethod === opt.id && (
                    <View style={st.radioDot} />
                  )}
                </View>
              </TouchableOpacity>
              {idx < PAYMENT_OPTIONS.length - 1 && <View style={st.methodDivider} />}
            </React.Fragment>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={st.bottomBar}>
        <TouchableOpacity
          style={[st.payBtn, !isValid && st.payBtnDisabled]}
          onPress={onTopUp}
          activeOpacity={0.8}
          disabled={!isValid || topUpPending}
          testID="confirm-topup-btn"
        >
          {topUpPending ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Text style={st.payBtnText}>
                {numericAmount > 0
                  ? `Top Up GH₵ ${numericAmount.toFixed(2)}`
                  : "Enter amount to top up"}
              </Text>
              <ChevronRight size={18} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.screenBg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 12,
  },
  currentBalanceWrap: {
    alignItems: "center",
    marginBottom: 20,
  },
  balancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  balancePillText: {
    fontSize: 13,
    color: Colors.gray600,
  },
  balancePillBold: {
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gray400,
    letterSpacing: 1,
    marginLeft: 20,
    marginBottom: 8,
  },
  amountCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  currency: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: Colors.gray400,
  },
  amountInput: {
    flex: 1,
    fontSize: 38,
    fontWeight: "800" as const,
    color: Colors.gray800,
    padding: 0,
    letterSpacing: -1,
  },
  quickAmountsRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
    alignItems: "center",
  },
  quickChipActive: {
    backgroundColor: Colors.primary,
  },
  quickChipText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.gray600,
  },
  quickChipTextActive: {
    color: Colors.white,
  },
  methodsCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 18,
    overflow: "hidden" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  methodLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  methodIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  methodLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.gray700,
  },
  methodSub: {
    fontSize: 12,
    color: Colors.gray400,
    marginTop: 1,
  },
  methodDivider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginLeft: 68,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.gray300,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 12,
    backgroundColor: Colors.screenBg,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  payBtnDisabled: {
    backgroundColor: Colors.gray300,
    shadowOpacity: 0,
    elevation: 0,
  },
  payBtnText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  successRoot: {
    flex: 1,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.white,
    marginBottom: 8,
  },
  successAmount: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: Colors.white,
    marginBottom: 8,
  },
  successSub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
  },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
