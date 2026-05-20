import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import {
  MapPin,
  Clock,
  Bus,
  ChevronDown,
  CheckCircle,
  AlertTriangle,
  BellRing,
  Route,
  Info,
  Calendar,
  CalendarDays,
  Repeat,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useLocation } from "@/contexts/LocationContext";
import { MOCK_APPROACHING_BUSES } from "@/mocks/data";
import { BusStop, Route as RouteType, DayOfWeek, ScheduleTimeMode, DayTimeEntry, AlertSchedule } from "@/types";
import { useBusAlerts } from "@/contexts/BusAlertContext";
const Colors = StaticColors;

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const ALL_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const WEEKENDS: DayOfWeek[] = ["Sat", "Sun"];

function formatTime12(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

export default function SetBusAlertScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const { addAlert, addPending } = useBusAlerts();
  const { regionStops, regionRoutes } = useLocation();

  const getRoutesForStop = useCallback((stopId: string): RouteType[] => {
    return regionRoutes.filter(
      (r) => r.status === "active" && r.stops_sequence.includes(stopId),
    );
  }, [regionRoutes]);

  const getBusPreviewForStop = useCallback((stopId: string, routeId?: string): number => {
    const buses = MOCK_APPROACHING_BUSES[stopId] ?? [];
    const filtered = buses.filter((b) => {
      if (b.seats_available <= 0) return false;
      if (routeId && routeId !== "any") {
        const route = regionRoutes.find((r) => r.id === routeId);
        if (route && b.route_name !== route.name) return false;
      }
      return true;
    });
    return filtered.length;
  }, [regionRoutes]);

  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<string>("any");
  const [selectedDays, setSelectedDays] = useState<DayOfWeek[]>([...ALL_DAYS]);
  const [timeMode, setTimeMode] = useState<ScheduleTimeMode>("same");
  const [sameHour, setSameHour] = useState<number>(new Date().getHours());
  const [sameMinute, setSameMinute] = useState<number>(Math.ceil(new Date().getMinutes() / 5) * 5 % 60);
  const [customTimes, setCustomTimes] = useState<DayTimeEntry[]>(
    ALL_DAYS.map((d) => ({ day: d, hour: new Date().getHours(), minute: Math.ceil(new Date().getMinutes() / 5) * 5 % 60 })),
  );
  const [editingDay, setEditingDay] = useState<DayOfWeek | null>(null);
  const [editingField, setEditingField] = useState<"hour" | "minute" | null>(null);

  const [showStopPicker, setShowStopPicker] = useState(false);
  const [showRoutePicker, setShowRoutePicker] = useState(false);
  const [showSameHourPicker, setShowSameHourPicker] = useState(false);
  const [showSameMinPicker, setShowSameMinPicker] = useState(false);
  const [done, setDone] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const successScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const stops = useMemo(() => regionStops, [regionStops]);

  const availableRoutes = useMemo(() => {
    if (!selectedStop) return [];
    return getRoutesForStop(selectedStop.id);
  }, [selectedStop, getRoutesForStop]);

  const busPreview = useMemo(() => {
    if (!selectedStop) return 0;
    return getBusPreviewForStop(selectedStop.id, selectedRoute);
  }, [selectedStop, selectedRoute, getBusPreviewForStop]);

  const selectedRouteName = useMemo(() => {
    if (selectedRoute === "any") return "Any route";
    return regionRoutes.find((r) => r.id === selectedRoute)?.name ?? "Unknown";
  }, [selectedRoute, regionRoutes]);

  const closeAllPickers = useCallback(() => {
    setShowStopPicker(false);
    setShowRoutePicker(false);
    setShowSameHourPicker(false);
    setShowSameMinPicker(false);
    setEditingDay(null);
    setEditingField(null);
  }, []);

  const toggleDay = useCallback((day: DayOfWeek) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length <= 1) return prev;
        return prev.filter((d) => d !== day);
      }
      return [...prev, day];
    });
  }, []);

  const selectPreset = useCallback((preset: "all" | "weekdays" | "weekends") => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    switch (preset) {
      case "all":
        setSelectedDays([...ALL_DAYS]);
        break;
      case "weekdays":
        setSelectedDays([...WEEKDAYS]);
        break;
      case "weekends":
        setSelectedDays([...WEEKENDS]);
        break;
    }
  }, []);

  const updateCustomTime = useCallback((day: DayOfWeek, hour: number, minute: number) => {
    setCustomTimes((prev) =>
      prev.map((t) => (t.day === day ? { ...t, hour, minute } : t)),
    );
  }, []);

  const isValid = !!selectedStop && selectedDays.length > 0;

  const scheduleDescription = useMemo(() => {
    if (selectedDays.length === 7) return "Every day";
    if (selectedDays.length === 5 && WEEKDAYS.every((d) => selectedDays.includes(d))) return "Weekdays";
    if (selectedDays.length === 2 && WEEKENDS.every((d) => selectedDays.includes(d))) return "Weekends";
    return selectedDays.join(", ");
  }, [selectedDays]);

  const submit = useCallback(async () => {
    if (!selectedStop || addPending) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.95, duration: 80, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();

    const schedule: AlertSchedule = {
      days: selectedDays,
      time_mode: timeMode,
    };

    if (timeMode === "same") {
      schedule.same_hour = sameHour;
      schedule.same_minute = sameMinute;
    } else {
      schedule.custom_times = customTimes.filter((t) => selectedDays.includes(t.day));
    }

    const now = new Date();
    const alertDate = new Date();
    if (timeMode === "same") {
      alertDate.setHours(sameHour, sameMinute, 0, 0);
    } else {
      const firstDay = customTimes.find((t) => selectedDays.includes(t.day));
      if (firstDay) {
        alertDate.setHours(firstDay.hour, firstDay.minute, 0, 0);
      }
    }
    if (alertDate.getTime() <= now.getTime()) {
      alertDate.setDate(alertDate.getDate() + 1);
    }

    try {
      await addAlert({
        route_id: selectedRoute,
        route_name: selectedRouteName,
        stop_id: selectedStop.id,
        stop_name: selectedStop.name,
        alert_time: alertDate.toISOString(),
        schedule,
      });
      setDone(true);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }).start();
    } catch {
      Alert.alert("Error", "Failed to create alert. Please try again.");
    }
  }, [selectedStop, selectedRoute, selectedRouteName, sameHour, sameMinute, selectedDays, timeMode, customTimes, addAlert, addPending, btnScale, successScale]);

  if (done) {
    const timeLabel = timeMode === "same"
      ? formatTime12(sameHour, sameMinute)
      : "Custom per day";

    return (
      <View style={st.root}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={st.successWrap}>
          <Animated.View style={[st.successCard, { transform: [{ scale: successScale }] }]}>
            <View style={st.successIconWrap}>
              <BellRing size={40} color={Colors.white} />
            </View>
            <Text style={st.successTitle}>Schedule Set!</Text>
            <Text style={st.successSub}>
              We'll notify you about buses at {selectedStop?.name} on your scheduled days.
            </Text>
            <View style={st.successDetails}>
              <View style={st.successRow}>
                <Text style={st.sLabel}>Bus Stop</Text>
                <Text style={st.sVal} numberOfLines={2}>{selectedStop?.name}</Text>
              </View>
              <View style={st.successRow}>
                <Text style={st.sLabel}>Route</Text>
                <Text style={st.sVal} numberOfLines={2}>{selectedRouteName}</Text>
              </View>
              <View style={st.successRow}>
                <Text style={st.sLabel}>Days</Text>
                <Text style={st.sVal} numberOfLines={2}>{scheduleDescription}</Text>
              </View>
              <View style={st.successRow}>
                <Text style={st.sLabel}>Time</Text>
                <Text style={st.sVal}>{timeLabel}</Text>
              </View>
            </View>
            <View style={st.warningBox}>
              <AlertTriangle size={14} color={Colors.warning} />
              <Text style={st.warningTxt}>
                Buses will not wait at the stop. Please be at the stop before the bus arrives.
              </Text>
            </View>
            <TouchableOpacity
              style={st.viewAlertsBtn}
              onPress={() => router.push("/my-alerts")}
              activeOpacity={0.7}
            >
              <Text style={st.viewAlertsTxt}>View My Alerts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.setAnotherBtn}
              onPress={() => {
                setDone(false);
                setSelectedStop(null);
                setSelectedRoute("any");
                setSelectedDays([...ALL_DAYS]);
                setTimeMode("same");
                successScale.setValue(0.8);
              }}
              activeOpacity={0.6}
            >
              <Text style={st.setAnotherTxt}>Set Another Alert</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.setAnotherBtn}
              onPress={() => router.back()}
              activeOpacity={0.6}
            >
              <Text style={[st.setAnotherTxt, { color: Colors.gray500 }]}>Back to Home</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={st.root}>
      <Stack.Screen
        options={{
          title: "Set Bus Alert",
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.gray800, fontWeight: "700" as const },
          headerTintColor: Colors.primary,
        }}
      />
      <Animated.View style={[st.flex, { opacity: fadeIn }]}>
        <ScrollView
          style={st.flex}
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={st.heroCard}>
            <View style={st.heroIcon}>
              <CalendarDays size={24} color={Colors.primary} />
            </View>
            <View style={st.heroText}>
              <Text style={st.heroTitle}>Schedule Bus Alert</Text>
              <Text style={st.heroSub}>
                Set a weekly schedule to get notified about buses at your stop.
              </Text>
            </View>
          </View>

          <View style={st.infoBar}>
            <Info size={13} color={Colors.info} />
            <Text style={st.infoTxt}>
              Choose specific days and times. Same time for all days, or a different time per day.
            </Text>
          </View>

          {/* STOP PICKER */}
          <Text style={st.label}>SELECT BUS STOP</Text>
          <TouchableOpacity
            style={st.picker}
            onPress={() => { closeAllPickers(); setShowStopPicker(!showStopPicker); }}
            activeOpacity={0.7}
            testID="stop-picker"
          >
            <MapPin size={18} color={Colors.primary} />
            <Text style={selectedStop ? st.pickerVal : st.pickerPH} numberOfLines={1}>
              {selectedStop?.name ?? "Choose a bus stop"}
            </Text>
            <ChevronDown size={18} color={Colors.gray400} />
          </TouchableOpacity>
          {showStopPicker && (
            <View style={st.dropdown}>
              <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled>
                {stops.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[st.ddItem, selectedStop?.id === s.id && st.ddActive]}
                    onPress={() => {
                      setSelectedStop(s);
                      setShowStopPicker(false);
                      setSelectedRoute("any");
                      if (Platform.OS !== "web") Haptics.selectionAsync();
                    }}
                    activeOpacity={0.6}
                  >
                    <View style={st.ddLeft}>
                      <Text style={[st.ddTxt, selectedStop?.id === s.id && st.ddTxtActive]}>
                        {s.name}
                      </Text>
                      <Text style={st.ddType}>
                        {s.type === "station" ? "Station" : "Stop"}
                      </Text>
                    </View>
                    {selectedStop?.id === s.id && (
                      <CheckCircle size={16} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ROUTE PICKER */}
          {selectedStop && (
            <>
              <Text style={st.label}>FILTER BY ROUTE (OPTIONAL)</Text>
              <TouchableOpacity
                style={st.picker}
                onPress={() => { closeAllPickers(); setShowRoutePicker(!showRoutePicker); }}
                activeOpacity={0.7}
              >
                <Route size={18} color={Colors.secondary} />
                <Text style={st.pickerVal} numberOfLines={1}>{selectedRouteName}</Text>
                <ChevronDown size={18} color={Colors.gray400} />
              </TouchableOpacity>
              {showRoutePicker && (
                <View style={st.dropdown}>
                  <TouchableOpacity
                    style={[st.ddItem, selectedRoute === "any" && st.ddActive]}
                    onPress={() => { setSelectedRoute("any"); setShowRoutePicker(false); }}
                    activeOpacity={0.6}
                  >
                    <View style={st.ddLeft}>
                      <Text style={[st.ddTxt, selectedRoute === "any" && st.ddTxtActive]}>
                        Any route
                      </Text>
                      <Text style={st.ddType}>Show all buses at this stop</Text>
                    </View>
                    {selectedRoute === "any" && <CheckCircle size={16} color={Colors.primary} />}
                  </TouchableOpacity>
                  {availableRoutes.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      style={[st.ddItem, selectedRoute === r.id && st.ddActive]}
                      onPress={() => { setSelectedRoute(r.id); setShowRoutePicker(false); }}
                      activeOpacity={0.6}
                    >
                      <View style={st.ddLeft}>
                        <Text style={[st.ddTxt, selectedRoute === r.id && st.ddTxtActive]}>
                          {r.name}
                        </Text>
                        <Text style={st.ddType}>
                          {r.origin} → {r.destination} · {r.distance_km}km
                        </Text>
                      </View>
                      {selectedRoute === r.id && <CheckCircle size={16} color={Colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* DAY SELECTION */}
          <Text style={st.label}>SELECT DAYS</Text>
          <View style={st.daysCard}>
            <View style={st.presetRow}>
              <TouchableOpacity
                style={[st.presetChip, selectedDays.length === 7 && st.presetChipOn]}
                onPress={() => selectPreset("all")}
                activeOpacity={0.7}
              >
                <Repeat size={13} color={selectedDays.length === 7 ? Colors.white : Colors.gray600} />
                <Text style={[st.presetTxt, selectedDays.length === 7 && st.presetTxtOn]}>Every day</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  st.presetChip,
                  selectedDays.length === 5 && WEEKDAYS.every((d) => selectedDays.includes(d)) && st.presetChipOn,
                ]}
                onPress={() => selectPreset("weekdays")}
                activeOpacity={0.7}
              >
                <Text style={[
                  st.presetTxt,
                  selectedDays.length === 5 && WEEKDAYS.every((d) => selectedDays.includes(d)) && st.presetTxtOn,
                ]}>Weekdays</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  st.presetChip,
                  selectedDays.length === 2 && WEEKENDS.every((d) => selectedDays.includes(d)) && st.presetChipOn,
                ]}
                onPress={() => selectPreset("weekends")}
                activeOpacity={0.7}
              >
                <Text style={[
                  st.presetTxt,
                  selectedDays.length === 2 && WEEKENDS.every((d) => selectedDays.includes(d)) && st.presetTxtOn,
                ]}>Weekends</Text>
              </TouchableOpacity>
            </View>
            <View style={st.daysRow}>
              {ALL_DAYS.map((day) => {
                const isSelected = selectedDays.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[st.dayChip, isSelected && st.dayChipOn]}
                    onPress={() => toggleDay(day)}
                    activeOpacity={0.7}
                  >
                    <Text style={[st.dayChipTxt, isSelected && st.dayChipTxtOn]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={st.daysSub}>{scheduleDescription}</Text>
          </View>

          {/* TIME MODE */}
          <Text style={st.label}>NOTIFICATION TIME</Text>
          <View style={st.timeModeCard}>
            <TouchableOpacity
              style={[st.timeModeOption, timeMode === "same" && st.timeModeOptionOn]}
              onPress={() => { setTimeMode("same"); closeAllPickers(); }}
              activeOpacity={0.7}
            >
              <View style={[st.timeModeRadio, timeMode === "same" && st.timeModeRadioOn]}>
                {timeMode === "same" && <View style={st.timeModeRadioDot} />}
              </View>
              <View style={st.timeModeContent}>
                <Text style={[st.timeModeLbl, timeMode === "same" && st.timeModeLblOn]}>Same time every day</Text>
                <Text style={st.timeModeDesc}>One notification time for all selected days</Text>
              </View>
            </TouchableOpacity>
            <View style={st.timeModeDivider} />
            <TouchableOpacity
              style={[st.timeModeOption, timeMode === "custom" && st.timeModeOptionOn]}
              onPress={() => { setTimeMode("custom"); closeAllPickers(); }}
              activeOpacity={0.7}
            >
              <View style={[st.timeModeRadio, timeMode === "custom" && st.timeModeRadioOn]}>
                {timeMode === "custom" && <View style={st.timeModeRadioDot} />}
              </View>
              <View style={st.timeModeContent}>
                <Text style={[st.timeModeLbl, timeMode === "custom" && st.timeModeLblOn]}>Different time per day</Text>
                <Text style={st.timeModeDesc}>Set individual times for each day</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* SAME TIME PICKER */}
          {timeMode === "same" && (
            <>
              <View style={st.timeCard}>
                <View style={st.timeDisplay}>
                  <TouchableOpacity
                    style={[st.timeSlot, showSameHourPicker && st.timeSlotActive]}
                    onPress={() => { closeAllPickers(); setShowSameHourPicker(!showSameHourPicker); }}
                    activeOpacity={0.7}
                  >
                    <Text style={st.timeNum}>{String(sameHour).padStart(2, "0")}</Text>
                    <Text style={st.timeSuffix}>hr</Text>
                  </TouchableOpacity>
                  <Text style={st.timeColon}>:</Text>
                  <TouchableOpacity
                    style={[st.timeSlot, showSameMinPicker && st.timeSlotActive]}
                    onPress={() => { closeAllPickers(); setShowSameMinPicker(!showSameMinPicker); }}
                    activeOpacity={0.7}
                  >
                    <Text style={st.timeNum}>{String(sameMinute).padStart(2, "0")}</Text>
                    <Text style={st.timeSuffix}>min</Text>
                  </TouchableOpacity>
                </View>
                <Text style={st.timeFormatted}>{formatTime12(sameHour, sameMinute)}</Text>
                <Text style={st.timeApplies}>Applies to {scheduleDescription}</Text>
              </View>

              {showSameHourPicker && (
                <View style={st.timeChipsWrap}>
                  <Text style={st.timeChipsLabel}>Select Hour</Text>
                  <View style={st.timeChips}>
                    {HOURS.map((h) => (
                      <TouchableOpacity
                        key={h}
                        style={[st.timeChip, sameHour === h && st.timeChipOn]}
                        onPress={() => { setSameHour(h); setShowSameHourPicker(false); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[st.timeChipTxt, sameHour === h && st.timeChipTxtOn]}>
                          {String(h).padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {showSameMinPicker && (
                <View style={st.timeChipsWrap}>
                  <Text style={st.timeChipsLabel}>Select Minutes</Text>
                  <View style={st.timeChips}>
                    {MINS.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[st.timeChip, sameMinute === m && st.timeChipOn]}
                        onPress={() => { setSameMinute(m); setShowSameMinPicker(false); }}
                        activeOpacity={0.7}
                      >
                        <Text style={[st.timeChipTxt, sameMinute === m && st.timeChipTxtOn]}>
                          {String(m).padStart(2, "0")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          {/* CUSTOM TIME PER DAY */}
          {timeMode === "custom" && (
            <View style={st.customTimesCard}>
              {ALL_DAYS.filter((d) => selectedDays.includes(d)).map((day) => {
                const entry = customTimes.find((t) => t.day === day);
                const hr = entry?.hour ?? 7;
                const mn = entry?.minute ?? 0;
                const isEditingHour = editingDay === day && editingField === "hour";
                const isEditingMin = editingDay === day && editingField === "minute";

                return (
                  <View key={day}>
                    <View style={st.customDayRow}>
                      <View style={st.customDayLabel}>
                        <Calendar size={14} color={Colors.primary} />
                        <Text style={st.customDayTxt}>{day}</Text>
                      </View>
                      <View style={st.customDayTime}>
                        <TouchableOpacity
                          style={[st.customTimeBtn, isEditingHour && st.customTimeBtnActive]}
                          onPress={() => {
                            if (isEditingHour) {
                              setEditingDay(null);
                              setEditingField(null);
                            } else {
                              closeAllPickers();
                              setEditingDay(day);
                              setEditingField("hour");
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[st.customTimeBtnTxt, isEditingHour && st.customTimeBtnTxtActive]}>
                            {String(hr).padStart(2, "0")}
                          </Text>
                        </TouchableOpacity>
                        <Text style={st.customTimeColon}>:</Text>
                        <TouchableOpacity
                          style={[st.customTimeBtn, isEditingMin && st.customTimeBtnActive]}
                          onPress={() => {
                            if (isEditingMin) {
                              setEditingDay(null);
                              setEditingField(null);
                            } else {
                              closeAllPickers();
                              setEditingDay(day);
                              setEditingField("minute");
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[st.customTimeBtnTxt, isEditingMin && st.customTimeBtnTxtActive]}>
                            {String(mn).padStart(2, "0")}
                          </Text>
                        </TouchableOpacity>
                        <Text style={st.customTimeAmpm}>{formatTime12(hr, mn).split(" ")[1]}</Text>
                      </View>
                    </View>

                    {isEditingHour && (
                      <View style={st.inlineChipsWrap}>
                        <View style={st.timeChips}>
                          {HOURS.map((h) => (
                            <TouchableOpacity
                              key={h}
                              style={[st.timeChip, hr === h && st.timeChipOn]}
                              onPress={() => {
                                updateCustomTime(day, h, mn);
                                setEditingDay(null);
                                setEditingField(null);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={[st.timeChipTxt, hr === h && st.timeChipTxtOn]}>
                                {String(h).padStart(2, "0")}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}

                    {isEditingMin && (
                      <View style={st.inlineChipsWrap}>
                        <View style={st.timeChips}>
                          {MINS.map((m) => (
                            <TouchableOpacity
                              key={m}
                              style={[st.timeChip, mn === m && st.timeChipOn]}
                              onPress={() => {
                                updateCustomTime(day, hr, m);
                                setEditingDay(null);
                                setEditingField(null);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text style={[st.timeChipTxt, mn === m && st.timeChipTxtOn]}>
                                {String(m).padStart(2, "0")}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {selectedStop && (
            <View style={st.previewCard}>
              <View style={st.previewHead}>
                <Bus size={16} color={Colors.primary} />
                <Text style={st.previewTitle}>Current Bus Preview</Text>
              </View>
              <Text style={st.previewCount}>
                {busPreview} bus{busPreview !== 1 ? "es" : ""} with available seats right now
              </Text>
              <Text style={st.previewDisclaimer}>
                Estimated arrival based on traffic conditions
              </Text>
            </View>
          )}

          <Animated.View style={{ transform: [{ scale: btnScale }] }}>
            <TouchableOpacity
              style={[st.submitBtn, (!isValid || addPending) && st.submitOff]}
              onPress={submit}
              activeOpacity={0.8}
              disabled={!isValid || addPending}
              testID="set-alert-btn"
            >
              {addPending ? (
                <ActivityIndicator color={Colors.white} size="small" />
              ) : (
                <>
                  <BellRing size={18} color={Colors.white} />
                  <Text style={st.submitTxt}>Set Schedule</Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  flex: { flex: 1 },
  scroll: { padding: 16 },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    gap: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.primaryFaded,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  heroText: { flex: 1 },
  heroTitle: { fontSize: 18, fontWeight: "800" as const, color: Colors.gray800, marginBottom: 4 },
  heroSub: { fontSize: 13, color: Colors.gray500, lineHeight: 18 },
  infoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.infoLight,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  infoTxt: { fontSize: 12, color: Colors.info, fontWeight: "500" as const, flex: 1, lineHeight: 17 },
  label: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gray400,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  picker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.gray200,
    marginBottom: 16,
  },
  pickerVal: { flex: 1, fontSize: 15, fontWeight: "600" as const, color: Colors.gray800 },
  pickerPH: { flex: 1, fontSize: 15, color: Colors.gray400 },
  dropdown: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.gray200,
    marginTop: -12,
    marginBottom: 16,
    overflow: "hidden" as const,
  },
  ddItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  ddActive: { backgroundColor: Colors.primaryFaded },
  ddLeft: { flex: 1 },
  ddTxt: { fontSize: 14, color: Colors.gray700, fontWeight: "500" as const },
  ddTxtActive: { color: Colors.primary, fontWeight: "700" as const },
  ddType: { fontSize: 11, color: Colors.gray400, marginTop: 2 },

  daysCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  presetRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.gray100,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
  },
  presetChipOn: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  presetTxt: { fontSize: 12, fontWeight: "600" as const, color: Colors.gray600 },
  presetTxtOn: { color: Colors.white },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  dayChip: {
    flex: 1,
    alignItems: "center" as const,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.gray100,
    borderWidth: 2,
    borderColor: "transparent",
  },
  dayChipOn: {
    backgroundColor: Colors.primaryFaded,
    borderColor: Colors.primary,
  },
  dayChipTxt: { fontSize: 12, fontWeight: "700" as const, color: Colors.gray400 },
  dayChipTxtOn: { color: Colors.primary },
  daysSub: {
    fontSize: 12,
    color: Colors.gray500,
    fontWeight: "500" as const,
    textAlign: "center" as const,
    marginTop: 12,
  },

  timeModeCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden" as const,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  timeModeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 14,
  },
  timeModeOptionOn: {
    backgroundColor: Colors.primaryFaded,
  },
  timeModeRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.gray300,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  timeModeRadioOn: {
    borderColor: Colors.primary,
  },
  timeModeRadioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  timeModeContent: { flex: 1 },
  timeModeLbl: { fontSize: 14, fontWeight: "600" as const, color: Colors.gray700 },
  timeModeLblOn: { color: Colors.primary, fontWeight: "700" as const },
  timeModeDesc: { fontSize: 11, color: Colors.gray400, marginTop: 2 },
  timeModeDivider: { height: 1, backgroundColor: Colors.gray200 },

  timeCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 20,
    alignItems: "center" as const,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  timeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  timeSlot: {
    backgroundColor: Colors.gray100,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center" as const,
    borderWidth: 2,
    borderColor: Colors.gray200,
    minWidth: 90,
  },
  timeSlotActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  timeNum: {
    fontSize: 32,
    fontWeight: "800" as const,
    color: Colors.gray800,
    fontVariant: ["tabular-nums" as const],
  },
  timeSuffix: { fontSize: 11, color: Colors.gray400, marginTop: 2 },
  timeColon: { fontSize: 32, fontWeight: "800" as const, color: Colors.gray400, marginHorizontal: 4 },
  timeFormatted: { fontSize: 14, color: Colors.gray500, fontWeight: "500" as const },
  timeApplies: { fontSize: 11, color: Colors.gray400, marginTop: 4 },
  timeChipsWrap: {
    backgroundColor: Colors.white,
    borderRadius: 14,
    padding: 14,
    marginTop: -12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  timeChipsLabel: { fontSize: 12, color: Colors.gray500, marginBottom: 10, fontWeight: "600" as const },
  timeChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.gray100,
    borderWidth: 1,
    borderColor: Colors.gray200,
    minWidth: 50,
    alignItems: "center" as const,
  },
  timeChipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  timeChipTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.gray700 },
  timeChipTxtOn: { color: Colors.white },

  customTimesCard: {
    backgroundColor: Colors.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  customDayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  customDayLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customDayTxt: { fontSize: 15, fontWeight: "700" as const, color: Colors.gray700 },
  customDayTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  customTimeBtn: {
    backgroundColor: Colors.gray100,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: Colors.gray200,
    minWidth: 48,
    alignItems: "center" as const,
  },
  customTimeBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryFaded,
  },
  customTimeBtnTxt: { fontSize: 16, fontWeight: "700" as const, color: Colors.gray700 },
  customTimeBtnTxtActive: { color: Colors.primary },
  customTimeColon: { fontSize: 16, fontWeight: "700" as const, color: Colors.gray400 },
  customTimeAmpm: { fontSize: 12, fontWeight: "600" as const, color: Colors.gray400, marginLeft: 4 },
  inlineChipsWrap: {
    paddingVertical: 10,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },

  previewCard: {
    backgroundColor: Colors.primaryFaded,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  previewHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  previewTitle: { fontSize: 13, fontWeight: "700" as const, color: Colors.primaryDark },
  previewCount: { fontSize: 14, fontWeight: "600" as const, color: Colors.gray700, marginBottom: 4 },
  previewDisclaimer: { fontSize: 10, color: Colors.gray400, fontStyle: "italic" as const },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 17,
    borderRadius: 14,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitOff: { opacity: 0.5 },
  submitTxt: { fontSize: 16, fontWeight: "700" as const, color: Colors.white },
  successWrap: { flex: 1, justifyContent: "center" as const, padding: 20, backgroundColor: Colors.screenBg },
  successCard: {
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
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 16,
  },
  successTitle: { fontSize: 24, fontWeight: "800" as const, color: Colors.gray800, marginBottom: 8 },
  successSub: { fontSize: 14, color: Colors.gray500, textAlign: "center" as const, marginBottom: 20, lineHeight: 20 },
  successDetails: {
    width: "100%" as const,
    backgroundColor: Colors.gray100,
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginBottom: 16,
  },
  successRow: { flexDirection: "row", justifyContent: "space-between" },
  sLabel: { fontSize: 13, color: Colors.gray500 },
  sVal: { fontSize: 13, fontWeight: "600" as const, color: Colors.gray800, textAlign: "right" as const, flex: 1, marginLeft: 12 },
  warningBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    width: "100%" as const,
  },
  warningTxt: { fontSize: 12, color: Colors.warning, fontWeight: "500" as const, flex: 1, lineHeight: 17 },
  viewAlertsBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 14,
    width: "100%" as const,
    alignItems: "center" as const,
  },
  viewAlertsTxt: { fontSize: 15, fontWeight: "700" as const, color: Colors.white },
  setAnotherBtn: { paddingVertical: 10, marginTop: 4 },
  setAnotherTxt: { fontSize: 14, fontWeight: "600" as const, color: Colors.primary },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
