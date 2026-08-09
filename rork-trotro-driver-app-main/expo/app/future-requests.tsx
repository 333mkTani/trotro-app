import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Bus,
  CalendarDays,
  Clock3,
  MapPin,
  Navigation,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { FutureRideRequest } from '@/types';
import {
  acceptFutureRequest,
  declineFutureRequest,
  departFutureRequest,
  getFutureRequestById,
  getFutureRequestHistory,
  getFutureRequests,
  getStopCoordinates,
  withdrawFutureRequest,
} from '@/services/driverApi';
import {
  FUTURE_REQUEST_LABELS,
  OPEN_FUTURE_STATUSES,
  UPCOMING_FUTURE_STATUSES,
  groupFutureRequests,
  invalidateScheduledRideQueries,
  isBackupMatchingActive,
  isNotificationSelected,
} from '@/utils/futureRequestState';

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Africa/Accra',
});

const formatTime = (value: string) => new Date(value).toLocaleTimeString(undefined, {
  hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Accra',
});

const formatCountdown = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
};

type Action = { id: string; kind: 'accept' | 'decline' | 'withdraw' | 'depart' };
type CardSection = 'awaiting' | 'upcoming' | 'history';

export default function FutureRequestsScreen() {
  const { occurrenceId } = useLocalSearchParams<{ occurrenceId?: string }>();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const scrollRef = useRef<ScrollView>(null);
  const didScrollToOccurrence = useRef(false);

  useEffect(() => {
    didScrollToOccurrence.current = false;
  }, [occurrenceId]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const requestsQuery = useQuery<FutureRideRequest[], Error>({
    queryKey: ['future-requests'],
    queryFn: getFutureRequests,
    refetchInterval: 30_000,
  });

  const historyQuery = useQuery<FutureRideRequest[], Error>({
    queryKey: ['future-request-history'],
    queryFn: getFutureRequestHistory,
    refetchInterval: 60_000,
  });

  const detailQuery = useQuery<FutureRideRequest, Error>({
    queryKey: ['future-request-detail', occurrenceId],
    queryFn: () => getFutureRequestById(occurrenceId!),
    enabled: Boolean(occurrenceId),
  });

  const actionMutation = useMutation<void, Error, Action>({
    mutationFn: ({ id, kind }) => {
      if (kind === 'accept') return acceptFutureRequest(id);
      if (kind === 'decline') return declineFutureRequest(id);
      if (kind === 'withdraw') return withdrawFutureRequest(id);
      return departFutureRequest(id);
    },
    onMutate: () => setErrorMessage(null),
    onSuccess: async (_result, action) => {
      await invalidateScheduledRideQueries(queryClient, action.id);
      if (action.kind === 'accept') Alert.alert('Seat request accepted', 'The passenger will be notified that their seat is confirmed.');
      if (action.kind === 'decline') Alert.alert('Request declined', 'The request will remain available to other eligible drivers.');
      if (action.kind === 'withdraw') Alert.alert('Acceptance withdrawn', 'The passenger request has returned to matching.');
      if (action.kind === 'depart') Alert.alert('Boarding closed', 'The scheduled occurrence has been marked as departed.');
    },
    onError: (error) => setErrorMessage(error.message || 'Could not update this request.'),
  });

  const grouped = useMemo(() => {
    const byId = new Map<string, FutureRideRequest>();
    for (const request of [...(requestsQuery.data ?? []), ...(historyQuery.data ?? [])]) byId.set(request.id, request);
    if (detailQuery.data) byId.set(detailQuery.data.id, detailQuery.data);
    const all = [...byId.values()];
    return groupFutureRequests(all);
  }, [detailQuery.data, historyQuery.data, requestsQuery.data]);

  const confirmAction = (request: FutureRideRequest, kind: Action['kind']) => {
    const copy = {
      accept: ['Accept future seat?', 'This reserves future capacity for the passenger.', 'Accept'],
      decline: ['Decline request?', 'Other eligible drivers may still accept it.', 'Decline'],
      withdraw: ['Withdraw acceptance?', 'The passenger will return to matching if boarding has not opened.', 'Withdraw'],
      depart: ['Mark bus as departed?', 'Boarding closes and unused reservations become no-shows.', 'Depart'],
    }[kind];
    Alert.alert(copy[0], copy[1], [
      { text: 'Cancel', style: 'cancel' },
      { text: copy[2], style: kind === 'accept' ? 'default' : 'destructive', onPress: () => actionMutation.mutate({ id: request.id, kind }) },
    ]);
  };

  const navigateToDeparture = async (request: FutureRideRequest) => {
    try {
      setErrorMessage(null);
      const coordinate = await getStopCoordinates(request.departureStopId);
      router.push({
        pathname: '/navigate',
        params: { lat: String(coordinate.lat), lng: String(coordinate.lng), name: request.departureStation },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not open navigation.');
    }
  };

  const renderCard = (request: FutureRideRequest, section: CardSection) => {
    const open = OPEN_FUTURE_STATUSES.includes(request.status);
    const accepted = UPCOMING_FUTURE_STATUSES.includes(request.status);
    const primaryMs = new Date(request.primaryDeadline).getTime();
    const finalMs = new Date(request.finalDeadline).getTime();
    const backupActive = isBackupMatchingActive(request, nowMs);
    const responseActionable = open && nowMs < finalMs;
    const countdownTarget = nowMs < primaryMs ? primaryMs : finalMs;
    const showCountdown = responseActionable && countdownTarget > nowMs;
    const busy = actionMutation.isPending && actionMutation.variables?.id === request.id;
    const canWithdraw = request.status === 'accepted';
    const canVerify = request.status === 'boarding_open';
    const canDepart = request.status === 'boarding_open' || request.status === 'boarded';

    return (
      <View
        key={request.id}
        style={[styles.card, isNotificationSelected(request.id, occurrenceId) && styles.highlightedCard]}
        onLayout={(event) => {
          if (occurrenceId !== request.id || didScrollToOccurrence.current) return;
          didScrollToOccurrence.current = true;
          scrollRef.current?.scrollTo({ y: Math.max(0, event.nativeEvent.layout.y - 12), animated: true });
        }}
        accessibilityLabel={`${FUTURE_REQUEST_LABELS[request.status]} future request from ${request.departureStation} to ${request.destinationStation}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.dateRow}><CalendarDays size={17} color={Colors.primary} /><Text style={styles.date}>{formatDate(request.boardingStart)}</Text></View>
          <View style={[styles.badge, open ? styles.awaitingBadge : accepted ? styles.acceptedBadge : styles.historyBadge]}>
            <Text style={[styles.badgeText, open ? styles.awaitingText : accepted ? styles.acceptedText : styles.historyText]}>{FUTURE_REQUEST_LABELS[request.status]}</Text>
          </View>
        </View>

        <View style={styles.detailRow}><UserRound size={16} color={Colors.textSecondary} /><Text style={styles.detailText}><Text style={styles.detailLabel}>Passenger: </Text>{request.passengerName}</Text></View>
        <View style={styles.detailRow}><Bus size={16} color={Colors.primary} /><Text style={styles.detailText}><Text style={styles.detailLabel}>Route: </Text>{request.routeName}</Text></View>
        <View style={styles.detailRow}><Clock3 size={16} color={Colors.textSecondary} /><Text style={styles.detailText}>{formatTime(request.boardingStart)} – {formatTime(request.boardingEnd)}</Text></View>
        <View style={styles.detailRow}><MapPin size={16} color={Colors.success} /><Text style={styles.detailText}><Text style={styles.detailLabel}>From: </Text>{request.departureStation}</Text></View>
        <View style={styles.detailRow}><Navigation size={16} color={Colors.primary} /><Text style={styles.detailText}><Text style={styles.detailLabel}>To: </Text>{request.destinationStation}</Text></View>
        {section !== 'history' ? <View style={styles.detailRow}><Users size={16} color={Colors.warning} /><Text style={styles.detailText}>{request.availableSeats} future seat{request.availableSeats === 1 ? '' : 's'} remaining</Text></View> : null}

        {backupActive ? <View style={styles.backupBanner}><Text style={styles.backupText}>Backup matching active</Text></View> : null}
        {showCountdown ? <Text style={styles.countdown}>{countdownTarget === finalMs ? 'Final response' : 'Primary response'} in {formatCountdown(countdownTarget - nowMs)}</Text> : null}

        {open ? (
          <View style={styles.deadlines}>
            <Text style={styles.deadlineText}>Primary deadline: {formatDate(request.primaryDeadline)}, {formatTime(request.primaryDeadline)}</Text>
            <Text style={styles.deadlineText}>Final deadline: {formatDate(request.finalDeadline)}, {formatTime(request.finalDeadline)}</Text>
          </View>
        ) : null}

        {responseActionable ? (
          <View style={styles.actionRow}>
            <Pressable style={[styles.dangerButton, styles.flexButton]} onPress={() => confirmAction(request, 'decline')} disabled={busy}>
              <Text style={styles.dangerButtonText}>Decline</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.flexButton]} onPress={() => confirmAction(request, 'accept')} disabled={busy}>
              {busy ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.primaryButtonText}>Accept seat</Text>}
            </Pressable>
          </View>
        ) : null}

        {accepted ? (
          <View style={styles.actionsColumn}>
            <View style={styles.actionRow}>
              <Pressable style={[styles.secondaryButton, styles.flexButton]} onPress={() => void navigateToDeparture(request)} disabled={busy}>
                <Navigation size={16} color={Colors.primary} /><Text style={styles.secondaryButtonText}>Navigate</Text>
              </Pressable>
              {canVerify ? <Pressable style={[styles.secondaryButton, styles.flexButton]} onPress={() => router.push('/(tabs)/verify')} disabled={busy}>
                <ShieldCheck size={16} color={Colors.primary} /><Text style={styles.secondaryButtonText}>Verify boarding</Text>
              </Pressable> : null}
            </View>
            {(canWithdraw || canDepart) ? <View style={styles.actionRow}>
              {canWithdraw ? <Pressable style={[styles.dangerButton, styles.flexButton]} onPress={() => confirmAction(request, 'withdraw')} disabled={busy}>
                <Text style={styles.dangerButtonText}>Withdraw</Text>
              </Pressable> : null}
              {canDepart ? <Pressable style={[styles.primaryButton, styles.flexButton]} onPress={() => confirmAction(request, 'depart')} disabled={busy}>
                {busy ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.primaryButtonText}>Mark departed</Text>}
              </Pressable> : null}
            </View> : null}
          </View>
        ) : null}
      </View>
    );
  };

  const refreshAll = async () => {
    await Promise.all([requestsQuery.refetch(), historyQuery.refetch(), occurrenceId ? detailQuery.refetch() : Promise.resolve()]);
  };

  if (requestsQuery.isLoading && historyQuery.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /><Text style={styles.loadingText}>Loading future requests…</Text></View>;
  }

  const queryError = requestsQuery.error ?? historyQuery.error ?? detailQuery.error;
  const refreshing = requestsQuery.isRefetching || historyQuery.isRefetching || detailQuery.isRefetching;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refreshAll()} colors={[Colors.primary]} tintColor={Colors.primary} />}
    >
      <View style={styles.hero}>
        <Bus size={25} color={Colors.white} />
        <View style={styles.heroCopy}><Text style={styles.heroTitle}>Future seat requests</Text><Text style={styles.heroText}>Accept only when you can serve the boarding window.</Text></View>
      </View>

      {(errorMessage || queryError) ? (
        <View style={styles.errorBanner}><AlertCircle size={18} color={Colors.error} /><Text style={styles.errorText}>{errorMessage ?? queryError?.message}</Text></View>
      ) : null}

      <Text style={styles.sectionTitle}>Awaiting response ({grouped.awaiting.length})</Text>
      {grouped.awaiting.length ? grouped.awaiting.map((request) => renderCard(request, 'awaiting')) : <View style={styles.empty}><Text style={styles.emptyTitle}>No requests awaiting response</Text><Text style={styles.emptyText}>New eligible requests will appear here.</Text></View>}

      <Text style={styles.sectionTitle}>Accepted upcoming trips ({grouped.upcoming.length})</Text>
      {grouped.upcoming.length ? grouped.upcoming.map((request) => renderCard(request, 'upcoming')) : <View style={styles.empty}><Text style={styles.emptyTitle}>No accepted upcoming trips</Text><Text style={styles.emptyText}>Accepted requests and boarding actions will appear here.</Text></View>}

      <Text style={styles.sectionTitle}>History ({grouped.history.length})</Text>
      {grouped.history.length ? grouped.history.map((request) => renderCard(request, 'history')) : <View style={styles.empty}><Text style={styles.emptyTitle}>No scheduled trip history</Text><Text style={styles.emptyText}>Finished, cancelled and expired trips will appear here.</Text></View>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  hero: { borderRadius: 18, backgroundColor: Colors.primary, padding: 18, flexDirection: 'row', gap: 13, alignItems: 'center', marginBottom: 16 },
  heroCopy: { flex: 1 }, heroTitle: { color: Colors.white, fontSize: 20, fontWeight: '800' as const }, heroText: { color: '#DCEBFF', fontSize: 13, marginTop: 3, lineHeight: 18 },
  errorBanner: { borderRadius: 12, borderWidth: 1, borderColor: '#F1B8B8', backgroundColor: '#FDECEC', padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 14 },
  errorText: { flex: 1, color: Colors.error, fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  sectionTitle: { fontSize: 17, fontWeight: '800' as const, color: Colors.textPrimary, marginTop: 8, marginBottom: 10 },
  card: { backgroundColor: Colors.surface, borderRadius: 16, borderWidth: 1, borderColor: Colors.borderLight, padding: 15, marginBottom: 13 },
  highlightedCard: { borderColor: Colors.primary, borderWidth: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 }, date: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' as const },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '58%' },
  acceptedBadge: { backgroundColor: '#E8F5E9' }, awaitingBadge: { backgroundColor: '#FFF3E0' }, historyBadge: { backgroundColor: '#EEF1F4' },
  badgeText: { fontSize: 10, fontWeight: '800' as const, textAlign: 'center' }, acceptedText: { color: Colors.success }, awaitingText: { color: Colors.warning }, historyText: { color: Colors.textSecondary },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }, detailText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 }, detailLabel: { color: Colors.textPrimary, fontWeight: '700' as const },
  backupBanner: { alignSelf: 'flex-start', borderRadius: 8, backgroundColor: '#FFF3E0', paddingHorizontal: 10, paddingVertical: 6, marginTop: 3 },
  backupText: { color: Colors.warning, fontSize: 12, fontWeight: '800' as const },
  countdown: { color: Colors.primary, fontSize: 13, fontWeight: '800' as const, marginTop: 9 },
  deadlines: { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 10, marginTop: 9, gap: 4 }, deadlineText: { fontSize: 12, lineHeight: 17, color: Colors.textSecondary },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 12 }, actionsColumn: { marginTop: 0 }, flexButton: { flex: 1 },
  primaryButton: { minHeight: 44, borderRadius: 11, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, primaryButtonText: { color: Colors.white, fontWeight: '700' as const, fontSize: 13 },
  dangerButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#F0B7B7', backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, dangerButtonText: { color: Colors.error, fontWeight: '700' as const, fontSize: 13 },
  secondaryButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#BCD2EC', backgroundColor: '#F4F8FD', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, flexDirection: 'row', gap: 6 }, secondaryButtonText: { color: Colors.primary, fontWeight: '700' as const, fontSize: 12 },
  empty: { borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderLight, padding: 18, alignItems: 'center', marginBottom: 18 }, emptyTitle: { color: Colors.textPrimary, fontWeight: '700' as const, fontSize: 14 }, emptyText: { color: Colors.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' },
});
