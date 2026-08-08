import React, { useEffect, useRef, useState } from 'react';
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
  Users,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import type { FutureRideRequest } from '@/types';
import {
  acceptFutureRequest,
  declineFutureRequest,
  departFutureRequest,
  getFutureRequests,
  getStopCoordinates,
  withdrawFutureRequest,
} from '@/services/driverApi';

const formatDate = (value: string) => new Date(value).toLocaleDateString(undefined, {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Africa/Accra',
});

const formatTime = (value: string) => new Date(value).toLocaleTimeString(undefined, {
  hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Accra',
});

type Action = { id: string; kind: 'accept' | 'decline' | 'withdraw' | 'depart' };

export default function FutureRequestsScreen() {
  const { occurrenceId } = useLocalSearchParams<{ occurrenceId?: string }>();
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const didScrollToOccurrence = useRef(false);

  useEffect(() => {
    didScrollToOccurrence.current = false;
  }, [occurrenceId]);

  const requestsQuery = useQuery<FutureRideRequest[], Error>({
    queryKey: ['future-requests'],
    queryFn: getFutureRequests,
    refetchInterval: 30_000,
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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['future-requests'] }),
        queryClient.invalidateQueries({ queryKey: ['bookings'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      if (action.kind === 'accept') Alert.alert('Seat request accepted', 'The passenger will be notified that their seat is confirmed.');
      if (action.kind === 'decline') Alert.alert('Request declined', 'The request will remain available to other eligible drivers.');
      if (action.kind === 'withdraw') Alert.alert('Acceptance withdrawn', 'The passenger request has returned to matching.');
      if (action.kind === 'depart') Alert.alert('Boarding closed', 'The scheduled occurrence has been marked as departed.');
    },
    onError: (error) => setErrorMessage(error.message || 'Could not update this request.'),
  });

  const requests = requestsQuery.data ?? [];
  const awaiting = requests.filter((request) => request.currentState === 'AWAITING');
  const accepted = requests.filter((request) => request.currentState === 'ACCEPTED');

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

  const renderCard = (request: FutureRideRequest) => {
    const isAccepted = request.currentState === 'ACCEPTED';
    const busy = actionMutation.isPending && actionMutation.variables?.id === request.id;
    return (
      <View
        key={request.id}
        style={[styles.card, occurrenceId === request.id && styles.highlightedCard]}
        onLayout={(event) => {
          if (occurrenceId !== request.id || didScrollToOccurrence.current) return;
          didScrollToOccurrence.current = true;
          scrollRef.current?.scrollTo({
            y: Math.max(0, event.nativeEvent.layout.y - 12),
            animated: true,
          });
        }}
        accessibilityLabel={`${request.currentState} future request from ${request.departureStation} to ${request.destinationStation}`}
      >
        <View style={styles.cardHeader}>
          <View style={styles.dateRow}><CalendarDays size={17} color={Colors.primary} /><Text style={styles.date}>{formatDate(request.boardingStart)}</Text></View>
          <View style={[styles.badge, isAccepted ? styles.acceptedBadge : styles.awaitingBadge]}>
            <Text style={[styles.badgeText, isAccepted ? styles.acceptedText : styles.awaitingText]}>{request.currentState}</Text>
          </View>
        </View>

        <View style={styles.detailRow}><Clock3 size={16} color={Colors.textSecondary} /><Text style={styles.detailText}>{formatTime(request.boardingStart)} – {formatTime(request.boardingEnd)}</Text></View>
        <View style={styles.detailRow}><MapPin size={16} color={Colors.success} /><Text style={styles.detailText}><Text style={styles.detailLabel}>From: </Text>{request.departureStation}</Text></View>
        <View style={styles.detailRow}><Navigation size={16} color={Colors.primary} /><Text style={styles.detailText}><Text style={styles.detailLabel}>To: </Text>{request.destinationStation}</Text></View>
        <View style={styles.detailRow}><Users size={16} color={Colors.warning} /><Text style={styles.detailText}>{request.availableSeats} future seat{request.availableSeats === 1 ? '' : 's'} remaining</Text></View>

        <View style={styles.deadlines}>
          <Text style={styles.deadlineText}>Primary response deadline: {formatDate(request.primaryDeadline)}, {formatTime(request.primaryDeadline)}</Text>
          <Text style={styles.deadlineText}>Final matching deadline: {formatDate(request.finalDeadline)}, {formatTime(request.finalDeadline)}</Text>
        </View>

        {isAccepted ? (
          <View style={styles.actionsColumn}>
            <View style={styles.actionRow}>
              <Pressable style={[styles.secondaryButton, styles.flexButton]} onPress={() => void navigateToDeparture(request)} disabled={busy}>
                <Navigation size={16} color={Colors.primary} /><Text style={styles.secondaryButtonText}>Navigate</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, styles.flexButton]} onPress={() => router.push('/(tabs)/verify')} disabled={busy}>
                <ShieldCheck size={16} color={Colors.primary} /><Text style={styles.secondaryButtonText}>Verify boarding</Text>
              </Pressable>
            </View>
            <View style={styles.actionRow}>
              <Pressable style={[styles.dangerButton, styles.flexButton]} onPress={() => confirmAction(request, 'withdraw')} disabled={busy}>
                <Text style={styles.dangerButtonText}>Withdraw</Text>
              </Pressable>
              <Pressable style={[styles.primaryButton, styles.flexButton]} onPress={() => confirmAction(request, 'depart')} disabled={busy}>
                {busy ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.primaryButtonText}>Mark departed</Text>}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.actionRow}>
            <Pressable style={[styles.dangerButton, styles.flexButton]} onPress={() => confirmAction(request, 'decline')} disabled={busy}>
              <Text style={styles.dangerButtonText}>Decline</Text>
            </Pressable>
            <Pressable style={[styles.primaryButton, styles.flexButton]} onPress={() => confirmAction(request, 'accept')} disabled={busy}>
              {busy ? <ActivityIndicator color={Colors.white} size="small" /> : <Text style={styles.primaryButtonText}>Accept seat</Text>}
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  if (requestsQuery.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /><Text style={styles.loadingText}>Loading future requests…</Text></View>;
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={requestsQuery.isRefetching} onRefresh={() => void requestsQuery.refetch()} colors={[Colors.primary]} tintColor={Colors.primary} />}
    >
      <View style={styles.hero}>
        <Bus size={25} color={Colors.white} />
        <View style={styles.heroCopy}><Text style={styles.heroTitle}>Future seat requests</Text><Text style={styles.heroText}>Accept only when you can serve the boarding window.</Text></View>
      </View>

      {(errorMessage || requestsQuery.error) ? (
        <View style={styles.errorBanner}><AlertCircle size={18} color={Colors.error} /><Text style={styles.errorText}>{errorMessage ?? requestsQuery.error?.message}</Text></View>
      ) : null}

      <Text style={styles.sectionTitle}>Awaiting response ({awaiting.length})</Text>
      {awaiting.length ? awaiting.map(renderCard) : <View style={styles.empty}><Text style={styles.emptyTitle}>No requests awaiting response</Text><Text style={styles.emptyText}>New eligible requests will appear here.</Text></View>}

      <Text style={styles.sectionTitle}>My accepted requests ({accepted.length})</Text>
      {accepted.length ? accepted.map(renderCard) : <View style={styles.empty}><Text style={styles.emptyTitle}>No accepted future requests</Text><Text style={styles.emptyText}>Accepted requests and boarding actions will appear here.</Text></View>}
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
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 12 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1 }, date: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' as const },
  badge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, acceptedBadge: { backgroundColor: '#E8F5E9' }, awaitingBadge: { backgroundColor: '#FFF3E0' },
  badgeText: { fontSize: 10, fontWeight: '800' as const }, acceptedText: { color: Colors.success }, awaitingText: { color: Colors.warning },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 }, detailText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 }, detailLabel: { color: Colors.textPrimary, fontWeight: '700' as const },
  deadlines: { borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: 10, marginTop: 3, gap: 4 }, deadlineText: { fontSize: 12, lineHeight: 17, color: Colors.textSecondary },
  actionRow: { flexDirection: 'row', gap: 9, marginTop: 12 }, actionsColumn: { marginTop: 0 }, flexButton: { flex: 1 },
  primaryButton: { minHeight: 44, borderRadius: 11, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, primaryButtonText: { color: Colors.white, fontWeight: '700' as const, fontSize: 13 },
  dangerButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#F0B7B7', backgroundColor: '#FFF5F5', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 }, dangerButtonText: { color: Colors.error, fontWeight: '700' as const, fontSize: 13 },
  secondaryButton: { minHeight: 44, borderRadius: 11, borderWidth: 1, borderColor: '#BCD2EC', backgroundColor: '#F4F8FD', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, flexDirection: 'row', gap: 6 }, secondaryButtonText: { color: Colors.primary, fontWeight: '700' as const, fontSize: 12 },
  empty: { borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.borderLight, padding: 18, alignItems: 'center', marginBottom: 18 }, emptyTitle: { color: Colors.textPrimary, fontWeight: '700' as const, fontSize: 14 }, emptyText: { color: Colors.textSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' },
});
