import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Bus, CalendarDays, Clock3, MapPin, ShieldCheck, UserRound } from 'lucide-react-native';
import { useCommuterSchedules } from '@/contexts/CommuterScheduleContext';
import { useLocation } from '@/contexts/LocationContext';
import { useTheme, type ThemePalette } from '@/contexts/ThemeContext';
import type { ScheduleOccurrence, ScheduleOccurrenceStatus } from '@/types';

const LABELS: Record<ScheduleOccurrenceStatus, string> = {
  pending: 'Searching — not confirmed',
  offered: 'Waiting for a driver',
  accepted: 'Accepted — seat confirmed',
  boarding_open: 'Boarding open',
  boarded: 'Boarded',
  departed: 'Departed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired / no-show',
  unmatched: 'No driver matched',
};

const AWAITING: ScheduleOccurrenceStatus[] = ['pending', 'offered'];
const UPCOMING: ScheduleOccurrenceStatus[] = ['accepted', 'boarding_open', 'boarded'];

const formatDateTime = (value: string) => new Date(value).toLocaleString(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  timeZone: 'Africa/Accra',
});

export default function FutureSeatsScreen() {
  const { occurrenceId } = useLocalSearchParams<{ occurrenceId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { regionStops, regionRoutes } = useLocation();
  const {
    schedules, schedulesLoading, refreshScheduleData, occurrenceRefreshToken,
    getAllOccurrences, cancelOccurrence, cancelOccurrencePending,
  } = useCommuterSchedules();
  const [occurrences, setOccurrences] = useState<ScheduleOccurrence[]>([]);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const didScroll = useRef(false);

  const loadOccurrences = useCallback(async () => {
    setLoadingOccurrences(true);
    setError(null);
    try {
      const list = await getAllOccurrences();
      setOccurrences(list.sort((a, b) => a.boarding_start_at.localeCompare(b.boarding_start_at)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load future seats.');
    } finally {
      setLoadingOccurrences(false);
    }
  }, [getAllOccurrences]);

  useEffect(() => { void loadOccurrences(); }, [loadOccurrences, occurrenceRefreshToken]);
  useEffect(() => { didScroll.current = false; }, [occurrenceId]);
  useFocusEffect(useCallback(() => { void refreshScheduleData(); }, [refreshScheduleData]));

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshScheduleData();
      await loadOccurrences();
    } finally {
      setRefreshing(false);
    }
  }, [loadOccurrences, refreshScheduleData]);

  const grouped = useMemo(() => ({
    awaiting: occurrences.filter((item) => AWAITING.includes(item.status)),
    upcoming: occurrences.filter((item) => UPCOMING.includes(item.status)),
    history: occurrences.filter((item) => !AWAITING.includes(item.status) && !UPCOMING.includes(item.status)),
  }), [occurrences]);

  const describeRoute = (occurrence: ScheduleOccurrence) => {
    const schedule = schedules.find((item) => item.id === occurrence.schedule_id);
    const route = occurrence.route_name ?? regionRoutes.find((item) => item.id === (schedule?.route_id ?? occurrence.route_id))?.name ?? 'Scheduled route';
    const departure = occurrence.departure_stop_name ?? regionStops.find((item) => item.id === (schedule?.departure_stop_id ?? occurrence.departure_stop_id))?.name ?? 'Departure station';
    const destination = occurrence.destination_stop_name ?? regionStops.find((item) => item.id === (schedule?.destination_stop_id ?? occurrence.destination_stop_id))?.name ?? 'Destination station';
    return { route, departure, destination };
  };

  const cancel = (occurrence: ScheduleOccurrence) => Alert.alert(
    'Cancel this future seat?',
    'The request will close and any accepted future capacity will be released.',
    [
      { text: 'Keep seat', style: 'cancel' },
      {
        text: 'Cancel seat', style: 'destructive', onPress: async () => {
          try {
            await cancelOccurrence(occurrence.id);
            setOccurrences((items) => items.map((item) =>
              item.id === occurrence.id ? { ...item, status: 'cancelled' } : item));
          } catch (cancelError) {
            Alert.alert('Could not cancel', cancelError instanceof Error ? cancelError.message : 'Try again.');
          }
        },
      },
    ],
  );

  const renderCard = (occurrence: ScheduleOccurrence, section: 'awaiting' | 'upcoming' | 'history') => {
    const route = describeRoute(occurrence);
    const selected = occurrence.id === occurrenceId;
    const positive = UPCOMING.includes(occurrence.status) || occurrence.status === 'completed';
    const negative = ['cancelled', 'expired', 'unmatched'].includes(occurrence.status);
    return (
      <View
        key={occurrence.id}
        style={[styles.card, selected && styles.selectedCard]}
        onLayout={(event) => {
          if (!selected || didScroll.current) return;
          didScroll.current = true;
          scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true });
        }}
        accessibilityLabel={`${LABELS[occurrence.status]} on ${occurrence.service_date}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.dateRow}><CalendarDays size={17} color={colors.primary} /><Text style={styles.date}>{formatDateTime(occurrence.boarding_start_at)}</Text></View>
          <View style={[styles.badge, positive ? styles.goodBadge : negative ? styles.badBadge : styles.waitBadge]}>
            <Text style={[styles.badgeText, { color: positive ? colors.success : negative ? colors.danger : colors.warning }]}>{LABELS[occurrence.status]}</Text>
          </View>
        </View>
        <View style={styles.row}><Bus size={16} color={colors.primary} /><Text style={styles.rowText}><Text style={styles.strong}>Route: </Text>{route.route}</Text></View>
        <View style={styles.row}><MapPin size={16} color={colors.success} /><Text style={styles.rowText}>{route.departure} → {route.destination}</Text></View>
        <View style={styles.row}><Clock3 size={16} color={colors.gray500} /><Text style={styles.rowText}>Boarding ends {formatDateTime(occurrence.boarding_end_at)}</Text></View>
        {occurrence.driver_name ? <View style={styles.row}><UserRound size={16} color={colors.gray500} /><Text style={styles.rowText}>{occurrence.driver_name}{occurrence.bus_registration ? ` · Bus ${occurrence.bus_registration}` : ''}</Text></View> : null}
        {occurrence.status === 'accepted' ? <Text style={styles.confirmed}>Your seat is confirmed. Travel to the departure station for boarding.</Text> : null}
        {occurrence.status === 'boarding_open' && occurrence.boarding_code && occurrence.code_status === 'active' ? (
          <View style={styles.codeBox}><ShieldCheck size={20} color={colors.primary} /><View><Text style={styles.codeLabel}>BOARDING CODE</Text><Text style={styles.code} selectable>{occurrence.boarding_code}</Text></View></View>
        ) : null}
        {section !== 'history' && ['pending', 'offered', 'accepted'].includes(occurrence.status) ? (
          <TouchableOpacity style={styles.cancelButton} disabled={cancelOccurrencePending} onPress={() => cancel(occurrence)}>
            <Text style={styles.cancelText}>{cancelOccurrencePending ? 'Cancelling…' : 'Cancel future seat'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  const section = (title: string, items: ScheduleOccurrence[], kind: 'awaiting' | 'upcoming' | 'history', empty: string) => (
    <>
      <Text style={styles.sectionTitle}>{title} ({items.length})</Text>
      {items.length ? items.map((item) => renderCard(item, kind)) : <View style={styles.empty}><Text style={styles.emptyText}>{empty}</Text></View>}
    </>
  );

  if ((schedulesLoading || loadingOccurrences) && !occurrences.length) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.muted}>Loading future seats…</Text></View>;
  }

  return (
    <ScrollView ref={scrollRef} style={styles.screen} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshAll()} tintColor={colors.primary} colors={[colors.primary]} />}>
      <View style={styles.hero}><CalendarDays size={28} color={colors.white} /><View style={{ flex: 1 }}><Text style={styles.heroTitle}>My future seats</Text><Text style={styles.heroText}>A saved schedule starts a search. Your seat is confirmed only after a driver accepts.</Text></View></View>
      {error ? <TouchableOpacity style={styles.error} onPress={() => void refreshAll()}><Text style={styles.errorText}>{error} Tap to retry.</Text></TouchableOpacity> : null}
      {section('Awaiting confirmation', grouped.awaiting, 'awaiting', 'No future requests are waiting for a driver.')}
      {section('Accepted future seats', grouped.upcoming, 'upcoming', 'No accepted future seats yet.')}
      {section('History', grouped.history, 'history', 'No future-seat history yet.')}
    </ScrollView>
  );
}

const makeStyles = (colors: ThemePalette) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg }, content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.screenBg }, muted: { color: colors.textMuted },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 18, borderRadius: 18, backgroundColor: colors.primary, marginBottom: 16 },
  heroTitle: { color: colors.white, fontSize: 21, fontWeight: '800' }, heroText: { color: '#FFF0E5', fontSize: 13, lineHeight: 18, marginTop: 3 },
  error: { padding: 12, borderRadius: 12, backgroundColor: colors.dangerLight, marginBottom: 12 }, errorText: { color: colors.danger, fontWeight: '600' },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 8, marginBottom: 10 },
  card: { backgroundColor: colors.cardBg, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 15, marginBottom: 12 },
  selectedCard: { borderColor: colors.primary, borderWidth: 2 }, cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, justifyContent: 'space-between', marginBottom: 12 },
  dateRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }, date: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '700' },
  badge: { maxWidth: '50%', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, goodBadge: { backgroundColor: colors.successLight }, badBadge: { backgroundColor: colors.dangerLight }, waitBadge: { backgroundColor: colors.warningLight },
  badgeText: { textAlign: 'center', fontSize: 10, fontWeight: '800' }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }, rowText: { flex: 1, color: colors.textMuted, fontSize: 13, lineHeight: 18 }, strong: { color: colors.text, fontWeight: '700' },
  confirmed: { color: colors.success, backgroundColor: colors.successLight, borderRadius: 10, padding: 10, fontSize: 12, fontWeight: '700', marginTop: 3 },
  codeBox: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.primaryFaded, borderRadius: 12, padding: 13, marginTop: 5 }, codeLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800' }, code: { color: colors.primary, fontSize: 25, fontWeight: '900', letterSpacing: 5 },
  cancelButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: 1, borderColor: colors.danger, marginTop: 12 }, cancelText: { color: colors.danger, fontWeight: '700' },
  empty: { borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, padding: 18, marginBottom: 18 }, emptyText: { color: colors.textMuted, textAlign: 'center', fontSize: 13 },
});
