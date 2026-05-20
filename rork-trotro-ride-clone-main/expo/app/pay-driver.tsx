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
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams, Stack } from "expo-router";
import {
  Wallet,
  Banknote,
  Check,
  Bus,
  MapPin,
  User,
  ChevronRight,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useWallet } from "@/contexts/WalletContext";
import { useBookings } from "@/contexts/BookingContext";
import { RidePaymentMethod } from "@/types";
const Colors = StaticColors;

type Params = {
  bookingId: string;
  driverName: string;
  busReg: string;
  routeName: string;
  pickupStop: string;
  destinationStop: string;
  suggestedFare: string;
};

const FARE_PRESETS = [2, 3, 5, 8, 10];

export default function PayDriverScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const { balance, payDriver, payDriverPending } = useWallet();
  const { completeRide, completePending } = useBookings();

  const [paymentMethod, setPaymentMethod] = useState<RidePaymentMethod | null>(null);
  const [fareAmount, setFareAmount] = useState<string>(params.suggestedFare || "");
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const fadeIn = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(30)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const numericFare = parseFloat(fareAmount) || 0;
  const canPay = paymentMethod !== null && numericFare >= 0.5;
  const isPending = payDriverPending || completePending;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(cardSlide, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
    ]).start();
  }, []);

  const onSelectPreset = useCallback((val: number) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFareAmount(String(val));
  }, []);

  const onSelectMethod = useCallback((method: RidePaymentMethod) => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPaymentMethod(method);
  }, []);

  const showSuccessAnimation = useCallback((msg: string) => {
    setSuccessMessage(msg);
    setShowSuccess(true);
    Animated.parallel([
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTimeout(() => {
      router.replace({
        pathname: "/rate-driver",
        params: {
          bookingId: params.bookingId ?? "",
          driverName: params.driverName ?? "",
          busReg: params.busReg ?? "",
          routeName: params.routeName ?? "",
          pickupStop: params.pickupStop ?? "",
          destinationStop: params.destinationStop ?? "",
          fare: String(numericFare || ""),
        },
      });
    }, 1800);
  }, [router, successScale, successOpacity, params, numericFare]);

  const handlePay = useCallback(async () => {
    if (!canPay || !paymentMethod || !params.bookingId) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      if (paymentMethod === "wallet") {
        if (balance < numericFare) {
          Alert.alert(
            "Insufficient Balance",
            `Your wallet balance is GH₵ ${balance.toFixed(2)}. Please top up or pay with cash.`,
            [{ text: "OK" }]
          );
          return;
        }

        await payDriver({
          amount: numericFare,
          description: `${params.pickupStop} → ${params.destinationStop}`,
          driverName: params.driverName || "Driver",
        });
      }

      await completeRide({
        bookingId: params.bookingId,
        paymentMethod,
        fare: numericFare,
      });

      const msg = paymentMethod === "wallet"
        ? `GH₵ ${numericFare.toFixed(2)} sent to ${params.driverName || "driver"}`
        : "Ride completed — please pay the driver in cash";
      showSuccessAnimation(msg);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Payment failed";
      Alert.alert("Error", msg);
    }
  }, [canPay, paymentMethod, numericFare, balance, params, payDriver, completeRide, showSuccessAnimation]);

  if (showSuccess) {
    return (
      <View style={st.successRoot}>
        <Stack.Screen options={{ headerShown: false }} />
        <Animated.View
          style={[st.successCircle, { opacity: successOpacity, transform: [{ scale: successScale }] }]}
        >
          <Check size={48} color={Colors.white} />
        </Animated.View>
        <Animated.Text style={[st.successTitle, { opacity: successOpacity }]}>
          {paymentMethod === "wallet" ? "Payment Sent!" : "Ride Ended!"}
        </Animated.Text>
        <Animated.Text style={[st.successSub, { opacity: successOpacity }]}>
          {successMessage}
        </Animated.Text>
        <Animated.Text style={[st.successNote, { opacity: successOpacity }]}>
          Seat freed for other passengers
        </Animated.Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={st.root}
      contentContainerStyle={st.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: cardSlide }] }}>
        <View style={st.rideCard}>
          <View style={st.rideHeader}>
            <View style={st.busIcon}>
              <Bus size={20} color={Colors.white} />
            </View>
            <View style={st.rideInfo}>
              <Text style={st.rideName} numberOfLines={1}>{params.routeName || "Ride"}</Text>
              <Text style={st.rideReg} numberOfLines={1}>{params.busReg}</Text>
            </View>
          </View>
          <View style={st.rideDivider} />
          <View style={st.rideStops}>
            <View style={st.stopRow}>
              <View style={[st.stopDot, { backgroundColor: Colors.primary }]} />
              <Text style={st.stopText} numberOfLines={1}>{params.pickupStop || "Pickup"}</Text>
            </View>
            <View style={st.stopLine} />
            <View style={st.stopRow}>
              <View style={[st.stopDot, { backgroundColor: Colors.success }]} />
              <Text style={st.stopText} numberOfLines={1}>{params.destinationStop || "Destination"}</Text>
            </View>
          </View>
          <View style={st.driverRow}>
            <View style={st.driverAvatar}>
              <User size={14} color={Colors.gray500} />
            </View>
            <Text style={st.driverLabel}>Driver:</Text>
            <Text style={st.driverName} numberOfLines={1}>{params.driverName || "Unknown"}</Text>
          </View>
        </View>

        <Text style={st.sectionLabel}>FARE AMOUNT</Text>
        <View style={st.fareCard}>
          <View style={st.fareInputRow}>
            <Text style={st.fareCurrency}>GH₵</Text>
            <TextInput
              style={st.fareInput}
              value={fareAmount}
              onChangeText={setFareAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.gray300}
              maxLength={6}
              testID="fare-input"
            />
          </View>
          <View style={st.presetsRow}>
            {FARE_PRESETS.map((val) => (
              <TouchableOpacity
                key={val}
                style={[st.presetChip, numericFare === val && st.presetChipActive]}
                onPress={() => onSelectPreset(val)}
                activeOpacity={0.7}
              >
                <Text style={[st.presetText, numericFare === val && st.presetTextActive]}>
                  {val}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={st.sectionLabel}>HOW WOULD YOU LIKE TO PAY?</Text>

        <TouchableOpacity
          style={[st.methodCard, paymentMethod === "wallet" && st.methodCardActive]}
          onPress={() => onSelectMethod("wallet")}
          activeOpacity={0.7}
          testID="pay-wallet"
        >
          <View style={st.methodLeft}>
            <View style={[st.methodIcon, { backgroundColor: Colors.primaryFaded }]}>
              <Wallet size={22} color={Colors.primary} />
            </View>
            <View style={st.methodInfo}>
              <Text style={st.methodTitle}>Pay with Wallet</Text>
              <Text style={st.methodDesc}>Transfer from your wallet to driver</Text>
              <View style={st.balanceBadge}>
                <Text style={st.balanceText}>Balance: GH₵ {balance.toFixed(2)}</Text>
              </View>
            </View>
          </View>
          <View style={[st.radio, paymentMethod === "wallet" && st.radioActive]}>
            {paymentMethod === "wallet" && <View style={st.radioDot} />}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[st.methodCard, paymentMethod === "cash" && st.methodCardActive]}
          onPress={() => onSelectMethod("cash")}
          activeOpacity={0.7}
          testID="pay-cash"
        >
          <View style={st.methodLeft}>
            <View style={[st.methodIcon, { backgroundColor: Colors.successLight }]}>
              <Banknote size={22} color={Colors.success} />
            </View>
            <View style={st.methodInfo}>
              <Text style={st.methodTitle}>Pay with Cash</Text>
              <Text style={st.methodDesc}>Hand cash directly to the driver</Text>
            </View>
          </View>
          <View style={[st.radio, paymentMethod === "cash" && st.radioActive]}>
            {paymentMethod === "cash" && <View style={st.radioDot} />}
          </View>
        </TouchableOpacity>

        {paymentMethod === "wallet" && numericFare > balance && (
          <View style={st.warningBanner}>
            <Text style={st.warningText}>
              Insufficient balance. You need GH₵ {(numericFare - balance).toFixed(2)} more. Top up or switch to cash.
            </Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </Animated.View>

      <View style={st.bottomArea}>
        <TouchableOpacity
          style={[st.payBtn, (!canPay || isPending) && st.payBtnDisabled]}
          onPress={handlePay}
          activeOpacity={0.8}
          disabled={!canPay || isPending}
          testID="confirm-pay-btn"
        >
          {isPending ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Text style={st.payBtnText} numberOfLines={1}>
                {paymentMethod === "wallet"
                  ? `Send GH₵${numericFare > 0 ? numericFare.toFixed(2) : "0.00"}`
                  : paymentMethod === "cash"
                    ? "Confirm Cash Payment"
                    : "Select payment method"}
              </Text>
              <ChevronRight size={18} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.screenBg,
  },
  scrollContent: {
    paddingTop: 12,
    paddingBottom: 30,
  },
  rideCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 18,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  rideHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  busIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  rideInfo: {
    flex: 1,
  },
  rideName: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.gray800,
  },
  rideReg: {
    fontSize: 13,
    color: Colors.gray500,
    marginTop: 2,
  },
  rideDivider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginVertical: 14,
  },
  rideStops: {
    paddingLeft: 6,
    marginBottom: 12,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  stopDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  stopText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.gray700,
    flex: 1,
  },
  stopLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.gray200,
    marginLeft: 4,
    marginVertical: 2,
  },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.gray100,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  driverAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.gray200,
    alignItems: "center",
    justifyContent: "center",
  },
  driverLabel: {
    fontSize: 12,
    color: Colors.gray500,
  },
  driverName: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.gray800,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gray400,
    letterSpacing: 1,
    marginLeft: 20,
    marginBottom: 10,
  },
  fareCard: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 18,
    padding: 18,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  fareInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  fareCurrency: {
    fontSize: 26,
    fontWeight: "700" as const,
    color: Colors.gray400,
  },
  fareInput: {
    flex: 1,
    fontSize: 36,
    fontWeight: "800" as const,
    color: Colors.gray800,
    padding: 0,
    letterSpacing: -1,
  },
  presetsRow: {
    flexDirection: "row",
    gap: 8,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
    alignItems: "center",
  },
  presetChipActive: {
    backgroundColor: Colors.primary,
  },
  presetText: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.gray600,
  },
  presetTextActive: {
    color: Colors.white,
  },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 18,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.gray100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  methodCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  methodLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  methodInfo: {
    flex: 1,
  },
  methodTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.gray800,
  },
  methodDesc: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 2,
  },
  balanceBadge: {
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: "flex-start" as const,
  },
  balanceText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.gray300,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  radioActive: {
    borderColor: Colors.primary,
  },
  radioDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
  },
  warningBanner: {
    marginHorizontal: 16,
    marginTop: 4,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 12,
  },
  warningText: {
    fontSize: 12,
    color: Colors.warning,
    fontWeight: "600" as const,
    lineHeight: 18,
  },
  bottomArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 17,
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
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
    flexShrink: 1,
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
    fontSize: 26,
    fontWeight: "800" as const,
    color: Colors.white,
    marginBottom: 10,
  },
  successSub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center" as const,
    lineHeight: 22,
    marginBottom: 8,
  },
  successNote: {
    fontSize: 13,
    color: "rgba(255,255,255,0.65)",
    fontStyle: "italic" as const,
  },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
