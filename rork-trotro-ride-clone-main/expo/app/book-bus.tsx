import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import {
  Bus,
  MapPin,
  Users,
  Clock,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  Navigation,
  Navigation2,
  ArrowRight,
  X,
  Banknote,
  QrCode,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBookings } from "@/contexts/BookingContext";
import { useLocation } from "@/contexts/LocationContext";
import { ALL_BUS_STOPS } from "@/mocks/stops";
import { ALL_ROUTES } from "@/mocks/routes";
import { BusStop, Booking } from "@/types";
import QRCode from "@/components/QRCode";
const Colors = StaticColors;

export default function BookBusScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const params = useLocalSearchParams<{
    driverId: string;
    driverName: string;
    busReg: string;
    routeName: string;
    seats: string;
    eta: string;
    stopId: string;
    stopName: string;
  }>();

  const { user } = useAuth();
  const { bookBus, bookBusPending } = useBookings();
  const { regionStops, regionRoutes } = useLocation();

  const [selectedDest, setSelectedDest] = useState<BusStop | null>(null);
  const [showDestPicker, setShowDestPicker] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookedBooking, setBookedBooking] = useState<Booking | null>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const route = useMemo(() => {
    return ALL_ROUTES.find((r) => r.name === params.routeName);
  }, [params.routeName]);

  const destinationStops = useMemo(() => {
    if (!route || !params.stopId) return [];
    const seq = route.stops_sequence;
    const pickupIdx = seq.indexOf(params.stopId);
    if (pickupIdx < 0) return [];
    return seq
      .slice(pickupIdx + 1)
      .map((id) => ALL_BUS_STOPS.find((s) => s.id === id))
      .filter((s): s is BusStop => !!s && s.status === "active");
  }, [route, params.stopId]);

  const estimatedTravelMin = useMemo(() => {
    if (!route || !selectedDest || !params.stopId) return null;
    const seq = route.stops_sequence;
    const pickupIdx = seq.indexOf(params.stopId);
    const destIdx = seq.indexOf(selectedDest.id);
    if (pickupIdx < 0 || destIdx < 0) return null;
    const fraction = (destIdx - pickupIdx) / (seq.length - 1);
    return Math.round(route.duration_min * fraction);
  }, [route, selectedDest, params.stopId]);

  const totalEta = useMemo(() => {
    const busEta = parseInt(params.eta ?? "0", 10);
    return estimatedTravelMin != null ? busEta + estimatedTravelMin : null;
  }, [params.eta, estimatedTravelMin]);

  const handleBook = useCallback(async () => {
    if (!selectedDest) {
      Alert.alert("Select Destination", "Please choose where you're going.");
      return;
    }
    if (!user) {
      Alert.alert("Sign In", "Please sign in to book a bus.");
      return;
    }

    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await bookBus({
        bus: {
          driver_id: params.driverId ?? "",
          bus_registration: params.busReg ?? "",
          driver_name: params.driverName ?? "",
          seats_available: parseInt(params.seats ?? "0", 10),
          eta_minutes: parseInt(params.eta ?? "0", 10),
          route_name: params.routeName ?? "",
          lat: 0,
          lng: 0,
        },
        pickupStopId: params.stopId ?? "",
        destinationStopId: selectedDest.id,
        passengerId: user.id,
      });

      setBookedBooking(result);
      setBooked(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Animated.spring(successScale, {
        toValue: 1,
        friction: 4,
        tension: 60,
        useNativeDriver: true,
      }).start();
    } catch (err) {
      console.log("[BookBus] Error:", err);
      Alert.alert("Booking Failed", "Something went wrong. Please try again.");
    }
  }, [selectedDest, user, bookBus, params, successScale]);

  const handleGoToRides = useCallback(() => {
    router.replace("/(tabs)/rides");
  }, [router]);

  const handleNavigateToStop = useCallback(() => {
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: "/navigate-to-pickup",
      params: {
        stopId: params.stopId ?? "",
        stopName: params.stopName ?? "",
        bookingId: "new",
        busReg: params.busReg ?? "",
        driverName: params.driverName ?? "",
        routeName: params.routeName ?? "",
        eta: params.eta ?? "0",
      },
    });
  }, [router, params]);

  if (booked) {
    return (
      <View style={st.root}>
        <Stack.Screen options={{ title: "Booking Confirmed", headerLeft: () => null }} />
        <ScrollView contentContainerStyle={st.successScroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[st.successContainer, { transform: [{ scale: successScale }] }]}>
          <View style={st.successIcon}>
            <CheckCircle size={56} color={Colors.success} />
          </View>
          <Text style={st.successTitle}>Seat Booked!</Text>
          <Text style={st.successSub}>
            Your seat on {params.busReg} has been confirmed.
          </Text>

          {bookedBooking?.verification_code && (
            <View style={st.codeCard}>
              <Text style={st.codeLabel}>YOUR BOARDING CODE</Text>
              <View style={st.codeRow}>
                {bookedBooking.verification_code.split("").map((c, i) => (
                  <View key={i} style={st.codeCell}>
                    <Text style={st.codeCellTxt}>{c}</Text>
                  </View>
                ))}
              </View>
              <View style={st.qrWrap}>
                <QRCode value={bookedBooking.verification_code} size={160} backgroundColor="#FFFFFF" />
              </View>
              <View style={st.qrHint}>
                <QrCode size={12} color={Colors.gray500} />
                <Text style={st.qrHintTxt}>Show code or QR to the driver</Text>
              </View>
            </View>
          )}

          <View style={st.successCard}>
            <View style={st.successRow}>
              <MapPin size={16} color={Colors.primary} />
              <View style={st.successRowText}>
                <Text style={st.successLabel}>Pickup</Text>
                <Text style={st.successValue}>{params.stopName}</Text>
              </View>
            </View>
            <View style={st.successDivider} />
            <View style={st.successRow}>
              <Navigation size={16} color={Colors.secondary} />
              <View style={st.successRowText}>
                <Text style={st.successLabel}>Destination</Text>
                <Text style={st.successValue}>{selectedDest?.name}</Text>
              </View>
            </View>
            <View style={st.successDivider} />
            <View style={st.successRow}>
              <Clock size={16} color={Colors.info} />
              <View style={st.successRowText}>
                <Text style={st.successLabel}>Bus arrives in</Text>
                <Text style={st.successValue}>~{params.eta} min</Text>
              </View>
            </View>
            {route && (
              <>
                <View style={st.successDivider} />
                <View style={st.successRow}>
                  <Banknote size={16} color={Colors.success} />
                  <View style={st.successRowText}>
                    <Text style={st.successLabel}>Fare</Text>
                    <Text style={[st.successValue, { color: Colors.success }]}>GH₵ {route.fare.toFixed(2)}</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={st.warningBanner}>
            <AlertTriangle size={14} color={Colors.warning} />
            <Text style={st.warningText}>
              Bus will not wait at the stop upon arrival. Please be at {params.stopName} before the bus arrives.
            </Text>
          </View>

          <Text style={st.etaNote}>
            Estimated arrival based on traffic conditions
          </Text>

          <TouchableOpacity style={st.navigateBtn} onPress={handleNavigateToStop} activeOpacity={0.7} testID="navigate-to-stop-btn">
            <Navigation2 size={18} color={Colors.white} />
            <Text style={st.navigateBtnText}>Navigate to Pickup Stop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.primaryBtn} onPress={handleGoToRides} activeOpacity={0.7}>
            <Text style={st.primaryBtnText}>View My Rides</Text>
          </TouchableOpacity>
          <TouchableOpacity style={st.secondaryBtn} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={st.secondaryBtnText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <Stack.Screen
        options={{
          title: "Book a Seat",
          headerStyle: { backgroundColor: Colors.screenBg },
          headerTintColor: Colors.primary,
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>
          <View style={st.busCard}>
            <View style={st.busCardHeader}>
              <View style={st.busIconWrap}>
                <Bus size={22} color={Colors.white} />
              </View>
              <View style={st.busCardHeaderText}>
                <Text style={st.busCardTitle} numberOfLines={1}>{params.busReg}</Text>
                <Text style={st.busCardSub} numberOfLines={1}>{params.driverName}</Text>
              </View>
            </View>

            <View style={st.busCardBody}>
              <View style={st.busStatRow}>
                <View style={st.busStat}>
                  <View style={[st.busStatIcon, { backgroundColor: Colors.primaryFaded }]}>
                    <Bus size={14} color={Colors.primary} />
                  </View>
                  <View style={st.busStatInfo}>
                    <Text style={st.busStatLabel}>Route</Text>
                    <Text style={st.busStatValue} numberOfLines={1}>{params.routeName}</Text>
                  </View>
                </View>
                {route && (
                  <View style={st.busStat}>
                    <View style={[st.busStatIcon, { backgroundColor: Colors.successLight }]}>
                      <Banknote size={14} color={Colors.success} />
                    </View>
                    <View style={st.busStatInfo}>
                      <Text style={st.busStatLabel}>Fare</Text>
                      <Text style={[st.busStatValue, { color: Colors.success }]} numberOfLines={1}>GH₵{route.fare.toFixed(2)}</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={st.busStatRow}>
                <View style={st.busStat}>
                  <View style={[st.busStatIcon, { backgroundColor: Colors.infoLight }]}>
                    <Clock size={14} color={Colors.info} />
                  </View>
                  <View style={st.busStatInfo}>
                    <Text style={st.busStatLabel}>Arrives at stop</Text>
                    <Text style={st.busStatValue} numberOfLines={1}>~{params.eta} min</Text>
                  </View>
                </View>
                <View style={st.busStat}>
                  <View style={[st.busStatIcon, { backgroundColor: Colors.successLight }]}>
                    <Users size={14} color={Colors.success} />
                  </View>
                  <View style={st.busStatInfo}>
                    <Text style={st.busStatLabel}>Available seats</Text>
                    <Text style={st.busStatValue} numberOfLines={1}>{params.seats}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={st.routeSection}>
            <Text style={st.sectionTitle}>Your Trip</Text>

            <View style={st.tripCard}>
              <View style={st.tripRow}>
                <View style={st.tripDotOrange} />
                <View style={st.tripStopInfo}>
                  <Text style={st.tripStopLabel}>Pickup Stop</Text>
                  <Text style={st.tripStopName} numberOfLines={2}>{params.stopName}</Text>
                </View>
              </View>

              <View style={st.tripLine} />

              <View style={st.tripRow}>
                <View style={st.tripDotGreen} />
                <View style={st.tripStopInfo}>
                  <Text style={st.tripStopLabel}>Destination</Text>
                  <TouchableOpacity
                    style={st.destPicker}
                    onPress={() => setShowDestPicker(!showDestPicker)}
                    activeOpacity={0.7}
                    testID="dest-picker"
                  >
                    <Text
                      style={[
                        st.destPickerText,
                        !selectedDest && st.destPickerPlaceholder,
                      ]}
                      numberOfLines={1}
                    >
                      {selectedDest?.name ?? "Select destination"}
                    </Text>
                    <ChevronDown size={16} color={Colors.gray400} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {showDestPicker && (
              <View style={st.destList}>
                {destinationStops.length > 0 ? (
                  destinationStops.map((stop) => (
                    <TouchableOpacity
                      key={stop.id}
                      style={[
                        st.destOption,
                        selectedDest?.id === stop.id && st.destOptionSelected,
                      ]}
                      onPress={() => {
                        setSelectedDest(stop);
                        setShowDestPicker(false);
                        if (Platform.OS !== "web")
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      activeOpacity={0.6}
                    >
                      <MapPin
                        size={14}
                        color={
                          selectedDest?.id === stop.id
                            ? Colors.primary
                            : Colors.gray400
                        }
                      />
                      <Text
                        style={[
                          st.destOptionText,
                          selectedDest?.id === stop.id && st.destOptionTextSelected,
                        ]}
                      >
                        {stop.name}
                      </Text>
                      {selectedDest?.id === stop.id && (
                        <CheckCircle size={14} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={st.noDestText}>
                    No further stops on this route from {params.stopName}
                  </Text>
                )}
              </View>
            )}

            {selectedDest && totalEta != null && (
              <View style={st.summaryCard}>
                <Text style={st.summaryTitle}>Trip Summary</Text>
                <View style={st.summaryRow}>
                  <Text style={st.summaryLabel}>Bus arrival at stop</Text>
                  <Text style={st.summaryValue}>~{params.eta} min</Text>
                </View>
                <View style={st.summaryRow}>
                  <Text style={st.summaryLabel}>Travel to destination</Text>
                  <Text style={st.summaryValue}>~{estimatedTravelMin} min</Text>
                </View>
                {route && (
                  <View style={st.summaryRow}>
                    <Text style={st.summaryLabel}>Fare</Text>
                    <Text style={[st.summaryValue, { color: Colors.success, fontWeight: "700" as const }]}>GH₵ {route.fare.toFixed(2)}</Text>
                  </View>
                )}
                <View style={st.summaryDivider} />
                <View style={st.summaryRow}>
                  <Text style={st.summaryTotalLabel}>Total estimated time</Text>
                  <Text style={st.summaryTotalValue}>~{totalEta} min</Text>
                </View>
                <Text style={st.summaryDisclaimer}>
                  Estimated arrival based on traffic conditions
                </Text>
              </View>
            )}
          </View>

          <View style={st.warningBanner}>
            <AlertTriangle size={14} color={Colors.warning} />
            <Text style={st.warningText}>
              The bus will not wait at the stop upon arrival. Be at {params.stopName} before the estimated arrival time.
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      <View style={st.footer}>
        <TouchableOpacity
          style={[
            st.bookButton,
            (!selectedDest || bookBusPending) && st.bookButtonDisabled,
          ]}
          onPress={handleBook}
          disabled={!selectedDest || bookBusPending}
          activeOpacity={0.7}
          testID="confirm-book-btn"
        >
          {bookBusPending ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Text style={st.bookButtonText} numberOfLines={1}>
                {selectedDest ? `Book to ${selectedDest.name}` : "Select a Destination"}
              </Text>
              <ArrowRight size={18} color={Colors.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
  scrollInner: {
    paddingBottom: 100,
  },
  busCard: {
    margin: 16,
    backgroundColor: Colors.white,
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  busCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: Colors.primary,
  },
  busIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  busCardHeaderText: {
    marginLeft: 12,
    flex: 1,
    minWidth: 0,
  },
  busCardTitle: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.white,
  },
  busCardSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  busCardBody: {
    padding: 16,
    gap: 12,
  },
  busStatRow: {
    flexDirection: "row",
    gap: 12,
  },
  busStat: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  busStatInfo: {
    flex: 1,
    minWidth: 0,
  },
  busStatIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  busStatLabel: {
    fontSize: 11,
    color: Colors.gray500,
  },
  busStatValue: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.gray800,
    marginTop: 1,
  },
  routeSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.gray800,
    marginBottom: 12,
  },
  tripCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  tripRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  tripDotOrange: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
    borderWidth: 3,
    borderColor: Colors.primaryFaded,
  },
  tripDotGreen: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.secondary,
    borderWidth: 3,
    borderColor: Colors.secondaryLight,
  },
  tripLine: {
    width: 2,
    height: 28,
    backgroundColor: Colors.gray200,
    marginLeft: 6,
    marginVertical: 2,
  },
  tripStopInfo: {
    flex: 1,
  },
  tripStopLabel: {
    fontSize: 11,
    color: Colors.gray500,
    marginBottom: 2,
  },
  tripStopName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.gray800,
  },
  destPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.gray100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  destPickerText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.gray800,
    flex: 1,
    marginRight: 8,
  },
  destPickerPlaceholder: {
    color: Colors.gray400,
    fontWeight: "400" as const,
  },
  destList: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    marginTop: 10,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  destOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  destOptionSelected: {
    backgroundColor: Colors.primaryFaded,
  },
  destOptionText: {
    flex: 1,
    fontSize: 15,
    color: Colors.gray700,
  },
  destOptionTextSelected: {
    color: Colors.primary,
    fontWeight: "600" as const,
  },
  noDestText: {
    fontSize: 13,
    color: Colors.gray400,
    textAlign: "center" as const,
    paddingVertical: 16,
  },
  summaryCard: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 16,
    marginTop: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.gray800,
    marginBottom: 10,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: Colors.gray500,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.gray700,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.gray100,
    marginVertical: 8,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.gray800,
  },
  summaryTotalValue: {
    fontSize: 16,
    fontWeight: "800" as const,
    color: Colors.primary,
  },
  summaryDisclaimer: {
    fontSize: 10,
    color: Colors.gray400,
    fontStyle: "italic" as const,
    textAlign: "center" as const,
    marginTop: 8,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.warning + "30",
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: Colors.warning,
    fontWeight: "500" as const,
    lineHeight: 17,
  },
  footer: {
    position: "absolute" as const,
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 8,
  },
  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  bookButtonText: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.white,
    flexShrink: 1,
  },
  bookButtonDisabled: {
    backgroundColor: Colors.gray300,
  },
  successScroll: {
    flexGrow: 1,
    paddingBottom: 24,
  },
  successContainer: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  successIcon: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: "800" as const,
    color: Colors.gray800,
    marginBottom: 8,
  },
  successSub: {
    fontSize: 15,
    color: Colors.gray500,
    textAlign: "center" as const,
    marginBottom: 24,
  },
  successCard: {
    width: "100%",
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  successRowText: {
    flex: 1,
  },
  successLabel: {
    fontSize: 11,
    color: Colors.gray400,
  },
  successValue: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.gray800,
    marginTop: 1,
  },
  successDivider: {
    height: 1,
    backgroundColor: Colors.gray100,
  },
  etaNote: {
    fontSize: 11,
    color: Colors.gray400,
    fontStyle: "italic" as const,
    textAlign: "center" as const,
    marginBottom: 20,
  },
  navigateBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.secondary,
    paddingVertical: 16,
    borderRadius: 14,
    marginBottom: 10,
  },
  navigateBtnText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  primaryBtn: {
    width: "100%",
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.white,
  },
  secondaryBtn: {
    width: "100%",
    backgroundColor: Colors.gray100,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.gray600,
  },
  codeCard: {
    width: "100%",
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: Colors.primaryFaded,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  codeLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gray500,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  codeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 16,
  },
  codeCell: {
    width: 34,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.gray50,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  codeCellTxt: {
    fontSize: 18,
    fontWeight: "900" as const,
    color: Colors.primary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  qrWrap: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: Colors.white,
    marginBottom: 10,
  },
  qrHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.gray50,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  qrHintTxt: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.gray500,
  },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
