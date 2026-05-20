import React, { useCallback, useRef, useEffect, useMemo } from "react";
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Stack } from "expo-router";
import {
  BellRing,
  BellOff,
  Clock,
  MapPin,
  Bus,
  Trash2,
  ChevronRight,
  AlertTriangle,
  Plus,
  Route,
  CheckCircle2,
  XCircle,
  CalendarDays,
  Repeat,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import StaticColors from "@/constants/colors";
import { useTheme, type ThemePalette } from "@/contexts/ThemeContext";
import { useBusAlerts } from "@/contexts/BusAlertContext";
import { BusAlert, DayOfWeek } from "@/types";
const Colors = StaticColors;

const WEEKDAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const WEEKENDS: DayOfWeek[] = ["Sat", "Sun"];

function formatAlertTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function formatTime12(hour: number, minute: number): string {
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${String(minute).padStart(2, "0")} ${ampm}`;
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function getTimeRemaining(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff <= 0) return "Now";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

function getScheduleLabel(alert: BusAlert): string {
  if (!alert.schedule || alert.schedule.days.length === 0) return "";
  const days = alert.schedule.days;
  if (days.length === 7) return "Every day";
  if (days.length === 5 && WEEKDAYS.every((d) => days.includes(d))) return "Weekdays";
  if (days.length === 2 && WEEKENDS.every((d) => days.includes(d))) return "Weekends";
  return days.join(", ");
}

function getScheduleTimeLabel(alert: BusAlert): string {
  if (!alert.schedule) return formatAlertTime(alert.alert_time);
  if (alert.schedule.time_mode === "same") {
    return formatTime12(alert.schedule.same_hour ?? 0, alert.schedule.same_minute ?? 0);
  }
  return "Custom times";
}

export default function MyAlertsScreen() {
  const { colors: themeColors } = useTheme();
  const Colors = themeColors;
  st = React.useMemo(() => make_st(themeColors), [themeColors]);

  const router = useRouter();
  const { activeAlerts, triggeredAlerts, pastAlerts, cancelAlert, deleteAlert, triggerAlert } = useBusAlerts();
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, []);

  const onCancel = useCallback(
    (id: string) => {
      Alert.alert("Cancel Alert", "Are you sure you want to cancel this alert?", [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Alert",
          style: "destructive",
          onPress: () => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            cancelAlert(id);
          },
        },
      ]);
    },
    [cancelAlert],
  );

  const onDelete = useCallback(
    (id: string) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      deleteAlert(id);
    },
    [deleteAlert],
  );

  const onTriggerNow = useCallback(
    async (id: string) => {
      if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      const result = await triggerAlert(id);
      if (result && result.buses.length > 0) {
        router.push({
          pathname: "/alert-buses",
          params: { alertId: result.alert.id },
        });
      } else {
        Alert.alert(
          "No Buses Available",
          "There are currently no buses with available seats approaching this stop.",
        );
      }
    },
    [triggerAlert, router],
  );

  const onViewBuses = useCallback(
    (alert: BusAlert) => {
      router.push({
        pathname: "/alert-buses",
        params: { alertId: alert.id },
      });
    },
    [router],
  );

  const hasAny = activeAlerts.length > 0 || triggeredAlerts.length > 0 || pastAlerts.length > 0;

  return (
    <View style={st.root}>
      <Stack.Screen
        options={{
          title: "My Bus Alerts",
          headerStyle: { backgroundColor: Colors.white },
          headerTitleStyle: { color: Colors.gray800, fontWeight: "700" as const },
          headerTintColor: Colors.primary,
          headerRight: () => (
            <TouchableOpacity
              onPress={() => router.push("/set-bus-alert")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={st.headerAdd}
            >
              <Plus size={20} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
      <Animated.View style={[st.flex, { opacity: fadeIn }]}>
        <ScrollView
          style={st.flex}
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
        >
          {!hasAny && (
            <View style={st.emptyWrap}>
              <View style={st.emptyIcon}>
                <BellOff size={40} color={Colors.gray300} />
              </View>
              <Text style={st.emptyTitle}>No Alerts Yet</Text>
              <Text style={st.emptySub}>
                Set a weekly schedule to get notified when buses with available seats are approaching your stop.
              </Text>
              <TouchableOpacity
                style={st.emptyBtn}
                onPress={() => router.push("/set-bus-alert")}
                activeOpacity={0.7}
              >
                <BellRing size={16} color={Colors.white} />
                <Text style={st.emptyBtnTxt}>Set Your First Alert</Text>
              </TouchableOpacity>
            </View>
          )}

          {triggeredAlerts.length > 0 && (
            <>
              <Text style={st.sectionLabel}>TRIGGERED — BUSES FOUND</Text>
              {triggeredAlerts.map((alert) => (
                <TriggeredAlertCard
                  key={alert.id}
                  alert={alert}
                  onView={() => onViewBuses(alert)}
                  onDelete={() => onDelete(alert.id)}
                />
              ))}
            </>
          )}

          {activeAlerts.length > 0 && (
            <>
              <Text style={st.sectionLabel}>ACTIVE ALERTS</Text>
              {activeAlerts.map((alert) => (
                <ActiveAlertCard
                  key={alert.id}
                  alert={alert}
                  onCancel={() => onCancel(alert.id)}
                  onTriggerNow={() => onTriggerNow(alert.id)}
                />
              ))}
            </>
          )}

          {pastAlerts.filter((a) => !a.triggered).length > 0 && (
            <>
              <Text style={st.sectionLabel}>PAST ALERTS</Text>
              {pastAlerts
                .filter((a) => !a.triggered)
                .map((alert) => (
                  <PastAlertCard key={alert.id} alert={alert} onDelete={() => onDelete(alert.id)} />
                ))}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const ScheduleBadge = React.memo(function ScheduleBadge({ alert }: { alert: BusAlert }) {
  const hasSchedule = !!alert.schedule && alert.schedule.days.length > 0;
  if (!hasSchedule) return null;

  const label = getScheduleLabel(alert);
  const isCustom = alert.schedule?.time_mode === "custom";

  return (
    <View style={st.scheduleBadgeWrap}>
      <View style={st.scheduleDaysRow}>
        <CalendarDays size={12} color={Colors.primary} />
        <Text style={st.scheduleDaysTxt}>{label}</Text>
      </View>
      {isCustom && alert.schedule?.custom_times && (
        <View style={st.customTimesPreview}>
          {alert.schedule.custom_times
            .filter((t) => alert.schedule!.days.includes(t.day))
            .map((t) => (
              <View key={t.day} style={st.customTimeTag}>
                <Text style={st.customTimeTagDay}>{t.day}</Text>
                <Text style={st.customTimeTagTime}>{formatTime12(t.hour, t.minute)}</Text>
              </View>
            ))}
        </View>
      )}
    </View>
  );
});

const ActiveAlertCard = React.memo(function ActiveAlertCard({
  alert,
  onCancel,
  onTriggerNow,
}: {
  alert: BusAlert;
  onCancel: () => void;
  onTriggerNow: () => void;
}) {
  const hasSchedule = !!alert.schedule && alert.schedule.days.length > 0;
  const timeLabel = getScheduleTimeLabel(alert);

  return (
    <View style={st.card}>
      <View style={st.cardHead}>
        <View style={st.activeIndicator}>
          <View style={st.activeDot} />
          <Text style={st.activeLabel}>{hasSchedule ? "Scheduled" : "Active"}</Text>
        </View>
        {hasSchedule ? (
          <View style={st.recurBadge}>
            <Repeat size={11} color={Colors.secondary} />
            <Text style={st.recurBadgeTxt}>Recurring</Text>
          </View>
        ) : (
          <View style={st.timeBadge}>
            <Clock size={12} color={Colors.primary} />
            <Text style={st.timeBadgeTxt}>{getTimeRemaining(alert.alert_time)}</Text>
          </View>
        )}
      </View>
      <View style={st.cardBody}>
        <View style={st.cardRow}>
          <MapPin size={15} color={Colors.primary} />
          <Text style={st.cardVal}>{alert.stop_name}</Text>
        </View>
        <View style={st.cardRow}>
          <Route size={15} color={Colors.secondary} />
          <Text style={st.cardVal}>{alert.route_name}</Text>
        </View>
        <View style={st.cardRow}>
          <Clock size={15} color={Colors.gray500} />
          <Text style={st.cardVal}>{timeLabel}</Text>
        </View>
        <ScheduleBadge alert={alert} />
      </View>
      <View style={st.cardActions}>
        <TouchableOpacity style={st.triggerBtn} onPress={onTriggerNow} activeOpacity={0.7}>
          <Bus size={14} color={Colors.white} />
          <Text style={st.triggerTxt}>Check Now</Text>
        </TouchableOpacity>
        <TouchableOpacity style={st.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <XCircle size={14} color={Colors.danger} />
          <Text style={st.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

const TriggeredAlertCard = React.memo(function TriggeredAlertCard({
  alert,
  onView,
  onDelete,
}: {
  alert: BusAlert;
  onView: () => void;
  onDelete: () => void;
}) {
  const busCount = alert.triggered_buses?.length ?? 0;
  const hasSchedule = !!alert.schedule && alert.schedule.days.length > 0;

  return (
    <TouchableOpacity style={[st.card, st.triggeredCard]} onPress={onView} activeOpacity={0.7}>
      <View style={st.cardHead}>
        <View style={st.triggeredBadge}>
          <CheckCircle2 size={14} color={Colors.success} />
          <Text style={st.triggeredLabel}>
            {busCount} bus{busCount !== 1 ? "es" : ""} found
          </Text>
        </View>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 size={16} color={Colors.gray400} />
        </TouchableOpacity>
      </View>
      <View style={st.cardBody}>
        <View style={st.cardRow}>
          <MapPin size={15} color={Colors.primary} />
          <Text style={st.cardVal}>{alert.stop_name}</Text>
        </View>
        <View style={st.cardRow}>
          <Clock size={15} color={Colors.gray500} />
          <Text style={st.cardVal}>{getScheduleTimeLabel(alert)}</Text>
        </View>
        <ScheduleBadge alert={alert} />
      </View>
      <View style={st.viewBusesRow}>
        <Text style={st.viewBusesTxt}>View buses & book a seat</Text>
        <ChevronRight size={16} color={Colors.primary} />
      </View>
      {hasSchedule && (
        <View style={st.scheduledNote}>
          <Repeat size={11} color={Colors.secondary} />
          <Text style={st.scheduledNoteTxt}>Will trigger again on next scheduled day</Text>
        </View>
      )}
      <View style={st.warningBar}>
        <AlertTriangle size={12} color={Colors.warning} />
        <Text style={st.warningBarTxt}>Buses will not wait at the stop</Text>
      </View>
    </TouchableOpacity>
  );
});

const PastAlertCard = React.memo(function PastAlertCard({
  alert,
  onDelete,
}: {
  alert: BusAlert;
  onDelete: () => void;
}) {
  return (
    <View style={[st.card, st.pastCard]}>
      <View style={st.cardHead}>
        <View style={st.pastBadge}>
          <BellOff size={12} color={Colors.gray400} />
          <Text style={st.pastLabel}>Cancelled</Text>
        </View>
        <TouchableOpacity
          onPress={onDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 size={16} color={Colors.gray400} />
        </TouchableOpacity>
      </View>
      <View style={st.cardBody}>
        <View style={st.cardRow}>
          <MapPin size={15} color={Colors.gray400} />
          <Text style={[st.cardVal, { color: Colors.gray400 }]}>{alert.stop_name}</Text>
        </View>
        <View style={st.cardRow}>
          <Clock size={15} color={Colors.gray400} />
          <Text style={[st.cardVal, { color: Colors.gray400 }]}>
            {getScheduleTimeLabel(alert)}
          </Text>
        </View>
      </View>
    </View>
  );
});



const make_st = (Colors: ThemePalette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.screenBg },
  flex: { flex: 1 },
  scroll: { padding: 16 },
  headerAdd: { marginRight: 8 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.gray400,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 8,
  },
  emptyWrap: {
    alignItems: "center" as const,
    paddingTop: 60,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.gray100,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: "800" as const, color: Colors.gray700, marginBottom: 8 },
  emptySub: {
    fontSize: 14,
    color: Colors.gray500,
    textAlign: "center" as const,
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderRadius: 14,
  },
  emptyBtnTxt: { fontSize: 15, fontWeight: "700" as const, color: Colors.white },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden" as const,
  },
  triggeredCard: {
    borderWidth: 1.5,
    borderColor: Colors.successLight,
  },
  pastCard: { opacity: 0.7 },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  activeIndicator: { flexDirection: "row", alignItems: "center", gap: 6 },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  activeLabel: { fontSize: 12, fontWeight: "700" as const, color: Colors.success },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primaryFaded,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  timeBadgeTxt: { fontSize: 12, fontWeight: "700" as const, color: Colors.primary },
  recurBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.secondaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recurBadgeTxt: { fontSize: 11, fontWeight: "700" as const, color: Colors.secondary },
  triggeredBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  triggeredLabel: { fontSize: 13, fontWeight: "700" as const, color: Colors.success },
  pastBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  pastLabel: { fontSize: 12, fontWeight: "600" as const, color: Colors.gray400 },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardVal: { fontSize: 14, fontWeight: "500" as const, color: Colors.gray700 },
  scheduleBadgeWrap: {
    marginTop: 4,
    backgroundColor: Colors.gray100,
    borderRadius: 10,
    padding: 10,
  },
  scheduleDaysRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scheduleDaysTxt: { fontSize: 12, fontWeight: "600" as const, color: Colors.primary },
  customTimesPreview: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  customTimeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.white,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.gray200,
  },
  customTimeTagDay: { fontSize: 11, fontWeight: "700" as const, color: Colors.gray600 },
  customTimeTagTime: { fontSize: 11, fontWeight: "500" as const, color: Colors.gray500 },
  cardActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  triggerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    backgroundColor: Colors.primary,
  },
  triggerTxt: { fontSize: 13, fontWeight: "700" as const, color: Colors.white },
  cancelBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 13,
    backgroundColor: Colors.dangerLight,
  },
  cancelTxt: { fontSize: 13, fontWeight: "600" as const, color: Colors.danger },
  viewBusesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.gray100,
  },
  viewBusesTxt: { fontSize: 14, fontWeight: "700" as const, color: Colors.primary },
  scheduledNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    backgroundColor: Colors.secondaryLight,
  },
  scheduledNoteTxt: { fontSize: 11, fontWeight: "500" as const, color: Colors.secondary },
  warningBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.warningLight,
    paddingVertical: 8,
  },
  warningBarTxt: { fontSize: 11, color: Colors.warning, fontWeight: "500" as const },
});

let st: ReturnType<typeof make_st> = make_st(StaticColors as unknown as ThemePalette);
