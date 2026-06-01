import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import {
  Search,
  MapPin,
  Navigation2,
  Bus,
  Users,
  Clock,
  ArrowRight,
  Footprints,
  Route,
  X,
  ChevronRight,
  Locate,
  AlertTriangle,
  CheckCircle,
  Timer,
  Map,
  Banknote,
  QrCode,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useLocation } from "@/contexts/LocationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBookings } from "@/contexts/BookingContext";
import QRCode from "@/components/QRCode";
import { BusStop, BufferMinutes, Booking } from "@/types";
import {
  findRouteRecommendations,
  searchStops,
  findNearbyStops,
  RouteRecommendation,
} from "@/utils/routeFinder";
const Colors = StaticColors;

const SCREEN_W = Dimensions.get("window").width;
const BUFFERS: BufferMinutes[] = [10, 15, 20];

type Phase = "search" | "results" | "confirm";

export default function FindRouteScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const params = useLocalSearchParams<{ pinLat?: string; pinLng?: string; pinLabel?: string }>();
  const { userLat, userLng, nearbyStops, regionStops, regionRoutes, activeBuses, regionName, mapCenter } = useLocation();
  const { user } = useAuth();
  const { bookBus } = useBookings();
  const [bookedBooking, setBookedBooking] = useState<Booking | null>(null);
  const currentLat = userLat ?? mapCenter.latitude;
  const currentLng = userLng ?? mapCenter.longitude;
  const [phase, setPhase] = useState<Phase>("search");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<BusStop[]>([]);
  const [selectedDest, setSelectedDest] = useState<BusStop | null>(null);
  const pinProcessed = useRef(false);
  const [recommendations, setRecommendations] = useState<RouteRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<RouteRecommendation | null>(null);
  const [buffer, setBuffer] = useState<BufferMinutes>(10);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(40)).current;
  const resultsFade = useRef(new Animated.Value(0)).current;
  const confirmSlide = useRef(new Animated.Value(SCREEN_W)).current;
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (params.pinLat && params.pinLng && !pinProcessed.current) {
      pinProcessed.current = true;
      const lat = parseFloat(params.pinLat);
      const lng = parseFloat(params.pinLng);
      const label = params.pinLabel ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      console.log("[FindRoute] Received pin from map:", lat, lng, label);

      const nearbyStops = findNearbyStops(lat, lng, 10000);
      if (nearbyStops.length > 0) {
        const closest = nearbyStops[0];
        setQuery(label);
        onSelectDestination(closest);
      } else {
        setQuery(label);
        Alert.alert("No Stops Nearby", "No bus stops found near the selected location. Try picking a different spot.");
      }
    }
  }, [params.pinLat, params.pinLng, params.pinLabel]);

  // Prefer backend UUID stops (nearbyStops) for searching; fall back to regionStops (may include mock)
  const stopsForSearch = nearbyStops.length > 0 ? nearbyStops.filter(s => s.status === 'active') : regionStops;

  const onSearch = useCallback((text: string) => {
    setQuery(text);
    if (text.length >= 1) {
      setSearchResults(searchStops(text, stopsForSearch.length > 0 ? stopsForSearch : undefined));
    } else {
      setSearchResults([]);
    }
  }, [stopsForSearch]);

  const onSelectDestination = useCallback(
    async (stop: BusStop) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedDest(stop);
      setQuery(stop.name);
      setSearchResults([]);
      setLoading(true);
      setPhase("results");

      await new Promise((r) => setTimeout(r, 800));

      const recs = findRouteRecommendations(currentLat, currentLng, stop.lat, stop.lng, 3000, stopsForSearch.length > 0 ? stopsForSearch : undefined, regionRoutes.length > 0 ? regionRoutes : undefined, activeBuses);
      setRecommendations(recs);
      setLoading(false);

      Animated.timing(resultsFade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    },
    [resultsFade, activeBuses, currentLat, currentLng, stopsForSearch, regionRoutes],
  );

  const onSelectRecommendation = useCallback(
    (rec: RouteRecommendation) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setSelected(rec);
      setPhase("confirm");
      Animated.spring(confirmSlide, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    },
    [confirmSlide],
  );

  const onBackToResults = useCallback(() => {
    setPhase("results");
    setSelected(null);
    Animated.timing(confirmSlide, {
      toValue: SCREEN_W,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [confirmSlide]);

  const onBook = useCallback(async () => {
    if (!selected) return;
    if (!user) {
      Alert.alert("Sign In", "Please sign in to book a seat.");
      return;
    }
    if (!selected.bestBus) {
      Alert.alert("No Bus Available", "No bus is currently available on this route.");
      return;
    }
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setBooking(true);
    try {
      const result = await bookBus({
        bus: {
          driver_id: selected.bestBus.driver_id,
          bus_registration: selected.bestBus.bus_registration,
          driver_name: selected.bestBus.driver_name,
          seats_available: selected.bestBus.seats_available,
          eta_minutes: selected.bestBus.eta_minutes,
          route_name: selected.route.name,
          lat: selected.bestBus.lat ?? 0,
          lng: selected.bestBus.lng ?? 0,
        },
        pickupStopId: selected.pickupStop.id,
        pickupStopName: selected.pickupStop.name,
        destinationStopId: selected.destinationStop.id,
        destinationStopName: selected.destinationStop.name,
        passengerId: user.id,
      });
      setBookedBooking(result);
      setBooked(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.log("[FindRoute] Booking error:", err);
      Alert.alert("Booking Failed", "Something went wrong. Please try again.");
    } finally {
      setBooking(false);
    }
  }, [selected, user, bookBus]);

  const onReset = useCallback(() => {
    setPhase("search");
    setQuery("");
    setSearchResults([]);
    setSelectedDest(null);
    setRecommendations([]);
    setSelected(null);
    setBooked(false);
    setBookedBooking(null);
    resultsFade.setValue(0);
    confirmSlide.setValue(SCREEN_W);
  }, [resultsFade, confirmSlide]);

  const allStops = useMemo(
    () => stopsForSearch,
    [stopsForSearch],
  );

  const popularStops = useMemo(
    () => allStops.slice(0, 6),
    [allStops],
  );

  if (booked && selected) {
    return (
      <View style={st.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={st.bookedWrap}>
          <View style={st.bookedCard}>
            <View style={st.bookedIconWrap}>
              <CheckCircle size={52} color={Colors.white} />
            </View>
            <Text style={st.bookedTitle}>Seat Reserved!</Text>
            <Text style={st.bookedSub}>
              Your trotro ride has been booked. We'll notify you when the bus is approaching.
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

            <View style={st.bookedDetails}>
              <DetailRow label="Route" value={selected.route.name} />
              <DetailRow label="Fare" value={`GH₵ ${selected.route.fare.toFixed(2)}`} />
              <DetailRow label="Pickup" value={selected.pickupStop.name} />
              <DetailRow label="Drop-off near" value={selected.destinationStop.name} />
              <DetailRow label="Bus" value={selected.bestBus?.bus_registration ?? "—"} />
              <DetailRow label="Driver" value={selected.bestBus?.driver_name ?? "—"} />
              <DetailRow
                label="Est. travel"
                value={`~${selected.estimatedTotalMinutes} min total`}
              />
              <DetailRow label="Buffer" value={`${buffer} min`} />
            </View>
            <Text style={st.etaNote}>Estimated arrival based on traffic conditions</Text>
            <View style={st.noWaitBooked}>
              <AlertTriangle size={13} color={Colors.warning} />
              <Text style={st.noWaitBookedTxt}>Buses will not wait for you at the stop. Please arrive before the bus does.</Text>
            </View>
            <TouchableOpacity
              style={st.bookedBtn}
              onPress={() => router.push("/(tabs)/rides")}
              activeOpacity={0.7}
            >
              <Text style={st.bookedBtnTxt}>View My Rides</Text>
            </TouchableOpacity>
            <TouchableOpacity style={st.bookedSecBtn} onPress={onReset} activeOpacity={0.6}>
              <Text style={st.bookedSecTxt}>Find Another Route</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.bookedSecBtn}
              onPress={() => router.back()}
              activeOpacity={0.6}
            >
              <Text style={[st.bookedSecTxt, { color: Colors.gray500 }]}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <Stack.Screen
        options={{
          title: "Find a Route",
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.gray800, fontWeight: "700" as const },
          headerTintColor: Colors.primary,
        }}
      />
      <KeyboardAvoidingView
        style={st.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={100}
      >
        <Animated.View
          style={[st.flex, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}
        >
          <View style={st.searchSection}>
            <View style={st.locRow}>
              <View style={st.locDot} />
              <Text style={st.locLabel}>Your location</Text>
              <Text style={st.locValue}>{regionName.split(',')[0]}</Text>
            </View>
            <View style={st.searchRow}>
              <View style={st.destDot} />
              <View style={st.searchInputWrap}>
                <Search size={16} color={Colors.gray400} />
                <TextInput
                  ref={inputRef}
                  style={st.searchInput}
                  placeholder="Where are you going?"
                  placeholderTextColor={Colors.gray400}
                  value={query}
                  onChangeText={onSearch}
                  autoFocus={phase === "search"}
                  returnKeyType="search"
                  testID="destination-search"
                />
                {query.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => {
                      onSearch("");
                      onReset();
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={16} color={Colors.gray400} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                      router.push("/pick-destination-map");
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={st.mapIconBtn}
                    activeOpacity={0.7}
                    testID="pick-on-map-icon"
                  >
                    <Map size={16} color={Colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={st.connectorLine} />
          </View>

          {phase === "search" && (
            <ScrollView
              style={st.flex}
              contentContainerStyle={st.searchContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {searchResults.length > 0 ? (
                <View>
                  <Text style={st.sectionLabel}>SEARCH RESULTS</Text>
                  {searchResults.map((stop) => (
                    <TouchableOpacity
                      key={stop.id}
                      style={st.resultItem}
                      onPress={() => onSelectDestination(stop)}
                      activeOpacity={0.6}
                    >
                      <View style={st.resultIcon}>
                        <MapPin size={16} color={Colors.primary} />
                      </View>
                      <View style={st.resultText}>
                        <Text style={st.resultName}>{stop.name}</Text>
                        <Text style={st.resultType}>
                          {stop.type === "station" ? "Station" : "Bus Stop"}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={Colors.gray300} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : query.length > 0 ? (
                <View style={st.emptySearch}>
                  <AlertTriangle size={28} color={Colors.gray300} />
                  <Text style={st.emptyText}>No stops matching "{query}"</Text>
                  <Text style={st.emptyHint}>Try a different name or browse popular stops</Text>
                </View>
              ) : null}

              {query.length === 0 && (
                <>
                  <Text style={st.sectionLabel}>POPULAR DESTINATIONS</Text>
                  <View style={st.popularGrid}>
                    {popularStops.map((stop) => (
                      <TouchableOpacity
                        key={stop.id}
                        style={st.popularChip}
                        onPress={() => onSelectDestination(stop)}
                        activeOpacity={0.7}
                      >
                        <MapPin size={14} color={Colors.primary} />
                        <Text style={st.popularName} numberOfLines={1}>
                          {stop.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={st.sectionLabel}>ALL BUS STOPS</Text>
                  {allStops.map((stop) => (
                    <TouchableOpacity
                      key={stop.id}
                      style={st.resultItem}
                      onPress={() => onSelectDestination(stop)}
                      activeOpacity={0.6}
                    >
                      <View
                        style={[
                          st.resultIcon,
                          stop.type === "station"
                            ? { backgroundColor: Colors.primaryFaded }
                            : { backgroundColor: "#E8F5E9" },
                        ]}
                      >
                        <MapPin
                          size={16}
                          color={stop.type === "station" ? Colors.primary : Colors.secondary}
                        />
                      </View>
                      <View style={st.resultText}>
                        <Text style={st.resultName}>{stop.name}</Text>
                        <Text style={st.resultType}>
                          {stop.type === "station" ? "Station" : "Bus Stop"}
                        </Text>
                      </View>
                      <ChevronRight size={16} color={Colors.gray300} />
                    </TouchableOpacity>
                  ))}
                </>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          )}

          {phase === "results" && (
            <ScrollView
              style={st.flex}
              contentContainerStyle={st.resultsContent}
              showsVerticalScrollIndicator={false}
            >
              {loading ? (
                <View style={st.loadingWrap}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={st.loadingText}>Finding best routes to {selectedDest?.name}...</Text>
                </View>
              ) : recommendations.length === 0 ? (
                <View style={st.noResults}>
                  <Route size={40} color={Colors.gray300} />
                  <Text style={st.noResultsTitle}>No routes found</Text>
                  <Text style={st.noResultsHint}>
                    No bus routes connect your area to {selectedDest?.name} right now. Try a
                    different destination.
                  </Text>
                  <TouchableOpacity style={st.retryBtn} onPress={onReset} activeOpacity={0.7}>
                    <Text style={st.retryTxt}>Search Again</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Animated.View style={{ opacity: resultsFade }}>
                  <View style={st.resultsHeader}>
                    <Text style={st.resultsTitle}>
                      {recommendations.length} route{recommendations.length > 1 ? "s" : ""} to{" "}
                      {selectedDest?.name}
                    </Text>
                    <Text style={st.resultsHint}>
                      Sorted by convenience. Only showing buses with available seats.
                    </Text>
                  </View>
                  {recommendations.map((rec, idx) => (
                    <RecommendationCard
                      key={rec.id}
                      rec={rec}
                      index={idx}
                      onPress={() => onSelectRecommendation(rec)}
                    />
                  ))}
                  <Text style={st.globalDisclaimer}>
                    Estimated arrival based on traffic conditions
                  </Text>
                  <View style={st.noWaitBanner}>
                    <AlertTriangle size={13} color={Colors.danger} />
                    <Text style={st.noWaitTxt}>Buses will not wait for passengers at the stop upon arrival. Please be there before the bus arrives.</Text>
                  </View>
                  <View style={{ height: 30 }} />
                </Animated.View>
              )}
            </ScrollView>
          )}

          {phase === "confirm" && selected && (
            <Animated.View
              style={[st.confirmWrap, { transform: [{ translateX: confirmSlide }] }]}
            >
              <ScrollView
                contentContainerStyle={st.confirmScroll}
                showsVerticalScrollIndicator={false}
              >
                <TouchableOpacity style={st.backRow} onPress={onBackToResults} activeOpacity={0.6}>
                  <ArrowRight
                    size={16}
                    color={Colors.primary}
                    style={{ transform: [{ rotate: "180deg" }] }}
                  />
                  <Text style={st.backTxt}>Back to options</Text>
                </TouchableOpacity>

                <View style={st.confirmCard}>
                  <View style={st.confirmRoutePill}>
                    <Bus size={14} color={Colors.white} />
                    <Text style={st.confirmRouteText}>{selected.route.name}</Text>
                  </View>

                  <View style={st.confirmStopsRow}>
                    <View style={st.confirmStopCol}>
                      <View style={[st.confirmDot, { backgroundColor: Colors.primary }]} />
                      <Text style={st.confirmStopLabel}>BOARD AT</Text>
                      <Text style={st.confirmStopName}>{selected.pickupStop.name}</Text>
                      <View style={st.walkChip}>
                        <Footprints size={11} color={Colors.info} />
                        <Text style={st.walkTxt}>
                          {selected.walkDistanceToPickup < 1000
                            ? `${selected.walkDistanceToPickup}m walk`
                            : `${(selected.walkDistanceToPickup / 1000).toFixed(1)}km walk`}
                        </Text>
                      </View>
                    </View>
                    <View style={st.confirmArrow}>
                      <ArrowRight size={18} color={Colors.gray300} />
                    </View>
                    <View style={[st.confirmStopCol, { alignItems: "flex-end" as const }]}>
                      <View style={[st.confirmDot, { backgroundColor: Colors.success }]} />
                      <Text style={st.confirmStopLabel}>ALIGHT NEAR</Text>
                      <Text style={st.confirmStopName}>{selected.destinationStop.name}</Text>
                      <View style={st.walkChip}>
                        <Footprints size={11} color={Colors.info} />
                        <Text style={st.walkTxt}>
                          {selected.walkDistanceToDest < 1000
                            ? `${selected.walkDistanceToDest}m to dest`
                            : `${(selected.walkDistanceToDest / 1000).toFixed(1)}km to dest`}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={st.confirmDivider} />

                  <View style={st.confirmInfoGrid}>
                    <InfoTile
                      icon={<Banknote size={16} color={Colors.success} />}
                      label="Fare"
                      value={`GH₵${selected.route.fare.toFixed(2)}`}
                    />
                    <InfoTile
                      icon={<Clock size={16} color={Colors.primary} />}
                      label="Total est."
                      value={`~${selected.estimatedTotalMinutes} min`}
                    />
                    <InfoTile
                      icon={<Navigation2 size={16} color={Colors.info} />}
                      label="Distance"
                      value={`${selected.route.distance_km} km`}
                    />
                  </View>

                  <Text style={st.busesLabel}>AVAILABLE BUSES</Text>
                  {selected.buses.map((bus) => (
                    <View key={bus.driver_id} style={st.busItem}>
                      <View style={st.busItemLeft}>
                        <View style={st.busIcon}>
                          <Bus size={14} color={Colors.primary} />
                        </View>
                        <View>
                          <Text style={st.busDriver}>{bus.driver_name}</Text>
                          <Text style={st.busReg}>{bus.bus_registration}</Text>
                        </View>
                      </View>
                      <View style={st.busItemRight}>
                        <View style={st.etaPill}>
                          <Text style={st.etaPillTxt}>{bus.eta_minutes} min</Text>
                        </View>
                        <View style={st.seatPill}>
                          <Users size={10} color={Colors.success} />
                          <Text style={st.seatPillTxt}>{bus.seats_available}</Text>
                        </View>
                      </View>
                    </View>
                  ))}

                  <Text style={st.miniDisclaimer}>
                    Estimated arrival based on traffic conditions
                  </Text>
                  <View style={st.noWaitMini}>
                    <AlertTriangle size={11} color={Colors.danger} />
                    <Text style={st.noWaitMiniTxt}>Buses will not wait at the stop upon arrival</Text>
                  </View>
                </View>

                <Text style={st.bufferLabel}>NOTIFICATION BUFFER</Text>
                <View style={st.bufferRow}>
                  {BUFFERS.map((b) => (
                    <TouchableOpacity
                      key={b}
                      style={[st.bufferChip, buffer === b && st.bufferChipOn]}
                      onPress={() => setBuffer(b)}
                      activeOpacity={0.7}
                    >
                      <Timer size={13} color={buffer === b ? Colors.white : Colors.gray500} />
                      <Text style={[st.bufferTxt, buffer === b && st.bufferTxtOn]}>
                        {b} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={st.bufferHint}>
                  We'll notify you {buffer} minutes before the bus arrives.
                </Text>

                <TouchableOpacity
                  style={[st.bookBtn, booking && st.bookBtnOff]}
                  onPress={onBook}
                  activeOpacity={0.8}
                  disabled={booking}
                  testID="book-seat-btn"
                >
                  {booking ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Text style={st.bookBtnTxt}>Book Seat Now</Text>
                  )}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </ScrollView>
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const DetailRow = React.memo(function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={st.detailRow}>
      <Text style={st.detailLabel}>{label}</Text>
      <Text style={st.detailValue}>{value}</Text>
    </View>
  );
});

const InfoTile = React.memo(function InfoTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <View style={st.infoTile}>
      {icon}
      <Text style={st.infoLabel} numberOfLines={1}>{label}</Text>
      <Text style={st.infoValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
});

const RecommendationCard = React.memo(function RecommendationCard({
  rec,
  index,
  onPress,
}: {
  rec: RouteRecommendation;
  index: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={st.recCard}
      onPress={onPress}
      activeOpacity={0.7}
      testID={`rec-card-${index}`}
    >
      {index === 0 && (
        <View style={st.bestBadge}>
          <Text style={st.bestBadgeTxt}>BEST OPTION</Text>
        </View>
      )}
      <View style={st.recTop}>
        <View style={st.recRoutePill}>
          <Bus size={12} color={Colors.primary} style={{ flexShrink: 0 }} />
          <Text style={st.recRouteText} numberOfLines={1}>{rec.route.name}</Text>
        </View>
        <View style={st.recTopRight}>
          <View style={st.recFarePill}>
            <Text style={st.recFareText}>GH₵ {rec.route.fare.toFixed(2)}</Text>
          </View>
          <View style={st.recTimePill}>
            <Clock size={11} color={Colors.white} />
            <Text style={st.recTimeText}>~{rec.estimatedTotalMinutes} min</Text>
          </View>
        </View>
      </View>

      <View style={st.recStopsRow}>
        <View style={st.recStopCol}>
          <View style={[st.recDot, { backgroundColor: Colors.primary }]} />
          <Text style={st.recStopLbl}>Board at</Text>
          <Text style={st.recStopVal}>{rec.pickupStop.name}</Text>
        </View>
        <ArrowRight size={14} color={Colors.gray300} style={{ marginTop: 14 }} />
        <View style={[st.recStopCol, { alignItems: "flex-end" as const }]}>
          <View style={[st.recDot, { backgroundColor: Colors.success }]} />
          <Text style={st.recStopLbl}>Alight near</Text>
          <Text style={st.recStopVal}>{rec.destinationStop.name}</Text>
        </View>
      </View>

      <View style={st.recMeta}>
        <View style={st.recMetaItem}>
          <Footprints size={12} color={Colors.info} />
          <Text style={st.recMetaText}>
            {rec.walkDistanceToPickup < 1000
              ? `${rec.walkDistanceToPickup}m`
              : `${(rec.walkDistanceToPickup / 1000).toFixed(1)}km`}{" "}
            walk
          </Text>
        </View>
        {rec.bestBus ? (
          <>
            <View style={st.recMetaDivider} />
            <View style={st.recMetaItem}>
              <Bus size={12} color={Colors.primary} />
              <Text style={st.recMetaText}>
                {rec.bestBus.bus_registration} · {rec.bestBus.eta_minutes} min
              </Text>
            </View>
            <View style={st.recMetaDivider} />
            <View style={st.recMetaItem}>
              <Users size={12} color={Colors.success} />
              <Text style={st.recMetaText}>{rec.bestBus.seats_available} seats</Text>
            </View>
          </>
        ) : (
          <>
            <View style={st.recMetaDivider} />
            <View style={st.recMetaItem}>
              <Bus size={12} color={Colors.gray400} />
              <Text style={[st.recMetaText, { color: Colors.gray400 }]}>No bus online now</Text>
            </View>
          </>
        )}
      </View>

      <View style={st.recAction}>
        <Text style={st.recActionTxt}>Select & Book</Text>
        <ChevronRight size={16} color={Colors.primary} />
      </View>
    </TouchableOpacity>
  );
});



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  flex: { flex: 1 },

  searchSection: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    marginHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
    zIndex: 10,
  },
  mapIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.primaryFaded,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingLeft: 2,
    gap: 10,
  },
  locDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.info,
    borderWidth: 2,
    borderColor: Colors.infoLight,
  },
  locLabel: { fontSize: 12, color: Colors.gray400, width: 90 },
  locValue: { fontSize: 14, fontWeight: "600" as const, color: Colors.gray700 },
  connectorLine: {
    position: "absolute" as const,
    left: 22,
    top: 28,
    width: 2,
    height: 34,
    backgroundColor: Colors.gray200,
    borderRadius: 1,
  },
  destDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.primaryFaded,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 2,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 10 : 0,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.gray800,
    paddingVertical: 11,
  },

  searchContent: { paddingTop: 16, paddingBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gray400,
    letterSpacing: 1,
    marginHorizontal: 20,
    marginBottom: 10,
    marginTop: 8,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 13,
    gap: 12,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  resultText: { flex: 1 },
  resultName: { fontSize: 15, fontWeight: "600" as const, color: Colors.gray800 },
  resultType: { fontSize: 12, color: Colors.gray400, marginTop: 1 },
  emptySearch: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 30,
    gap: 8,
  },
  emptyText: { fontSize: 15, fontWeight: "600" as const, color: Colors.gray600 },
  emptyHint: { fontSize: 13, color: Colors.gray400, textAlign: "center" as const },
  popularGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 20,
  },
  popularChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.white,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  popularName: { fontSize: 13, fontWeight: "500" as const, color: Colors.gray700 },
  pickOnMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: Colors.white,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.gray200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  pickOnMapIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  pickOnMapText: {
    flex: 1,
  },
  pickOnMapTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.gray800,
  },
  pickOnMapSub: {
    fontSize: 12,
    color: Colors.gray500,
    marginTop: 2,
  },

  resultsContent: { paddingTop: 16, paddingBottom: 20 },
  loadingWrap: { alignItems: "center", paddingTop: 60, gap: 16 },
  loadingText: { fontSize: 14, color: Colors.gray500 },
  noResults: { alignItems: "center", paddingTop: 50, paddingHorizontal: 30, gap: 10 },
  noResultsTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.gray700 },
  noResultsHint: { fontSize: 14, color: Colors.gray400, textAlign: "center" as const },
  retryBtn: {
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  retryTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
  resultsHeader: { paddingHorizontal: 20, marginBottom: 14 },
  resultsTitle: { fontSize: 18, fontWeight: "700" as const, color: Colors.gray800 },
  resultsHint: { fontSize: 12, color: Colors.gray400, marginTop: 4 },

  recCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden" as const,
  },
  bestBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: "flex-start" as const,
    borderBottomRightRadius: 10,
  },
  bestBadgeTxt: {
    fontSize: 10,
    fontWeight: "800" as const,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  recTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  recRoutePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 1,
    minWidth: 0,
  },
  recRouteText: { fontSize: 12, fontWeight: "600" as const, color: Colors.primary, flexShrink: 1 },
  recTopRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
    marginLeft: 8,
  },
  recFarePill: {
    backgroundColor: Colors.successLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  recFareText: {
    fontSize: 12,
    fontWeight: "800" as const,
    color: Colors.success,
  },
  recTimePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.secondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  recTimeText: { fontSize: 12, fontWeight: "700" as const, color: Colors.white },
  recStopsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  recStopCol: { flex: 1 },
  recDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 3 },
  recStopLbl: { fontSize: 10, color: Colors.gray400, textTransform: "uppercase" as const },
  recStopVal: { fontSize: 14, fontWeight: "600" as const, color: Colors.gray800, marginTop: 1 },
  recMeta: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
    gap: 6,
  },
  recMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  recMetaText: { fontSize: 11, color: Colors.gray500 },
  recMetaDivider: { width: 1, height: 12, backgroundColor: Colors.gray200 },
  recAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
    paddingVertical: 11,
  },
  recActionTxt: { fontSize: 13, fontWeight: "700" as const, color: Colors.primary },
  noWaitBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.dangerLight,
    padding: 12,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  noWaitTxt: { fontSize: 12, color: Colors.danger, fontWeight: "500" as const, flex: 1, lineHeight: 17 },
  noWaitMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  noWaitMiniTxt: { fontSize: 10, color: Colors.danger, fontWeight: "500" as const },
  noWaitBooked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    width: "100%" as const,
  },
  noWaitBookedTxt: { fontSize: 12, color: Colors.warning, fontWeight: "500" as const, flex: 1, lineHeight: 17 },
  globalDisclaimer: {
    fontSize: 10,
    color: Colors.gray400,
    fontStyle: "italic" as const,
    textAlign: "center" as const,
    marginTop: 8,
    paddingHorizontal: 20,
  },

  confirmWrap: { flex: 1 },
  confirmScroll: { padding: 16 },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
    paddingVertical: 4,
  },
  backTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
  confirmCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  confirmRoutePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: "flex-start" as const,
    marginBottom: 16,
  },
  confirmRouteText: { fontSize: 13, fontWeight: "700" as const, color: Colors.white },
  confirmStopsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  confirmStopCol: { flex: 1 },
  confirmDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  confirmStopLabel: {
    fontSize: 10,
    color: Colors.gray400,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  confirmStopName: { fontSize: 16, fontWeight: "700" as const, color: Colors.gray800 },
  confirmArrow: { paddingHorizontal: 8, paddingTop: 16 },
  walkChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.infoLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
    alignSelf: "flex-start" as const,
  },
  walkTxt: { fontSize: 11, color: Colors.info, fontWeight: "500" as const },
  confirmDivider: { height: 1, backgroundColor: Colors.gray100, marginVertical: 12 },
  confirmInfoGrid: { flexDirection: "row", gap: 8, marginBottom: 16 },
  infoTile: {
    flex: 1,
    backgroundColor: Colors.gray50,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  infoLabel: { fontSize: 11, color: Colors.gray400 },
  infoValue: { fontSize: 16, fontWeight: "700" as const, color: Colors.gray800 },
  busesLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gray400,
    letterSpacing: 1,
    marginBottom: 8,
  },
  busItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  busItemLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  busIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primaryFaded,
    alignItems: "center",
    justifyContent: "center",
  },
  busDriver: { fontSize: 14, fontWeight: "600" as const, color: Colors.gray700 },
  busReg: { fontSize: 11, color: Colors.gray400 },
  busItemRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  etaPill: {
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  etaPillTxt: { fontSize: 12, fontWeight: "700" as const, color: Colors.primary },
  seatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  seatPillTxt: { fontSize: 11, fontWeight: "600" as const, color: Colors.success },
  miniDisclaimer: {
    fontSize: 10,
    color: Colors.gray400,
    fontStyle: "italic" as const,
    marginTop: 10,
  },

  bufferLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gray400,
    letterSpacing: 1,
    marginBottom: 10,
  },
  bufferRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  bufferChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  bufferChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  bufferTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.gray600 },
  bufferTxtOn: { color: Colors.white },
  bufferHint: {
    fontSize: 12,
    color: Colors.gray400,
    fontStyle: "italic" as const,
    marginBottom: 24,
  },

  bookBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 14,
    alignItems: "center" as const,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bookBtnOff: { opacity: 0.7 },
  bookBtnTxt: { fontSize: 16, fontWeight: "700" as const, color: Colors.white },

  bookedWrap: {
    flex: 1,
    justifyContent: "center" as const,
    padding: 20,
    backgroundColor: Colors.screenBg,
  },
  bookedCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 28,
    alignItems: "center" as const,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  bookedIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.success,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  bookedTitle: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.gray800,
    marginBottom: 8,
  },
  bookedSub: {
    fontSize: 14,
    color: Colors.gray500,
    textAlign: "center" as const,
    marginBottom: 20,
    lineHeight: 20,
  },
  bookedDetails: {
    width: "100%" as const,
    backgroundColor: Colors.gray50,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginBottom: 16,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { fontSize: 13, color: Colors.gray500 },
  detailValue: { fontSize: 13, fontWeight: "600" as const, color: Colors.gray800 },
  etaNote: {
    fontSize: 10,
    color: Colors.gray400,
    fontStyle: "italic" as const,
    marginBottom: 20,
  },
  bookedBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    width: "100%" as const,
    alignItems: "center" as const,
  },
  bookedBtnTxt: { fontSize: 15, fontWeight: "700" as const, color: Colors.white },
  bookedSecBtn: { paddingVertical: 10, marginTop: 4 },
  bookedSecTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
  codeCard: {
    width: "100%" as const,
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: Colors.primaryFaded,
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
