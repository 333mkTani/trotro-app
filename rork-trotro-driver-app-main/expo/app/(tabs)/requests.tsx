import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Navigation,
  MapPin,
  Clock,
  Inbox,
  Check,
  X,
  User,
  ArrowRight,
  CheckCircle,
  XCircle,
  Route,
  CircleStop,
  Zap,
  Lock,
} from 'lucide-react-native';
import { router } from 'expo-router';
import Colors from '@/constants/colors';
import {
  getOverflowRequests,
  acceptOverflowRequest,
  declineOverflowRequest,
  autoAcceptBooking,
} from '@/services/driverApi';
import { useBookingStore } from '@/store/bookingStore';
import { useDriverStore } from '@/store/driverStore';
import { OverflowRequest, AutoAcceptedBooking } from '@/types';
import { formatTimeAgo, formatDistance, getTimeRemaining } from '@/utils/helpers';
import {
  checkForNewRequests,
  sendLocalRequestNotification,
  sendBatchRequestNotification,
  setBadgeCount,
  sendRequestStatusNotification,
  sendAutoAcceptNotification,
} from '@/services/notificationService';

function RequestCard({
  item,
  onAccept,
  onDecline,
  onNavigate,
  isAccepting,
  isDeclining,
  isStationary,
}: {
  item: OverflowRequest;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onNavigate: (lat: number, lng: number, stopName?: string) => void;
  isAccepting: boolean;
  isDeclining: boolean;
  isStationary: boolean;
}) {
  const rem = getTimeRemaining(item.expires_at);
  const isOpen = item.status === 'OPEN';
  const isAccepted = item.status === 'ACCEPTED';
  const isDeclined = item.status === 'DECLINED';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const statusBadge = useMemo(() => {
    if (isAccepted) return { bg: '#E8F5E9', text: '#2E7D32', label: 'Accepted' };
    if (isDeclined) return { bg: '#FFEBEE', text: '#C62828', label: 'Declined' };
    if (rem.text === 'Expired') return { bg: '#F5F5F5', text: '#64748B', label: 'Expired' };
    return null;
  }, [isAccepted, isDeclined, rem.text]);

  return (
    <Animated.View
      style={[
        rs.card,
        isAccepted && rs.cardAccepted,
        isDeclined && rs.cardDeclined,
        !isStationary && isOpen && rs.cardDriving,
        { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
      ]}
      testID={`ov-${item.id}`}
    >
      <View style={rs.cardTop}>
        <View style={rs.stopRow}>
          <View style={rs.stopIcon}>
            <MapPin size={16} color={Colors.white} />
          </View>
          <View style={rs.stopInfo}>
            <Text style={rs.stopName} numberOfLines={1}>{item.stop_name}</Text>
            {item.passenger_name ? (
              <Text style={rs.passengerName}>{item.passenger_name}</Text>
            ) : null}
          </View>
        </View>
        {statusBadge ? (
          <View style={[rs.statusBadge, { backgroundColor: statusBadge.bg }]}>
            {isAccepted ? <CheckCircle size={12} color={statusBadge.text} /> : null}
            {isDeclined ? <XCircle size={12} color={statusBadge.text} /> : null}
            <Text style={[rs.statusText, { color: statusBadge.text }]}>{statusBadge.label}</Text>
          </View>
        ) : (
          <View style={[rs.timer, rem.isUrgent && rs.timerUrgent]}>
            <Clock size={12} color={rem.isUrgent ? Colors.error : Colors.textSecondary} />
            <Text style={[rs.timerText, rem.isUrgent && rs.timerTextUrgent]}>{rem.text}</Text>
          </View>
        )}
      </View>

      <View style={rs.routeContainer}>
        <View style={rs.routeVisual}>
          <View style={rs.routeDotGreen} />
          <View style={rs.routeLine} />
          <View style={rs.routeDotRed} />
        </View>
        <View style={rs.routeLabels}>
          <View style={rs.routeItem}>
            <Text style={rs.routeLabel}>Pickup</Text>
            <Text style={rs.routeValue} numberOfLines={1}>{item.pickup_stop}</Text>
          </View>
          <View style={rs.routeItem}>
            <Text style={rs.routeLabel}>Destination</Text>
            <Text style={rs.routeValue} numberOfLines={1}>{item.destination_stop ?? item.stop_name}</Text>
          </View>
        </View>
      </View>

      <View style={rs.metaRow}>
        <View style={rs.metaChip}>
          <User size={12} color={Colors.primary} />
          <Text style={rs.metaChipTextIndividual}>1 passenger</Text>
        </View>
        <Text style={rs.metaDist}>{formatDistance(item.distance_km)}</Text>
        <Text style={rs.metaAgo}>{formatTimeAgo(item.time_posted)}</Text>
      </View>

      {isOpen && rem.text !== 'Expired' && isStationary ? (
        <View style={rs.actions}>
          <Pressable
            style={({ pressed }) => [rs.declineBtn, pressed && rs.btnPressed]}
            onPress={() => onDecline(item.id)}
            disabled={isDeclining || isAccepting}
            testID={`decline-ov-${item.id}`}
          >
            {isDeclining ? (
              <ActivityIndicator size="small" color={Colors.error} />
            ) : (
              <>
                <X size={16} color={Colors.error} />
                <Text style={rs.declineText}>Decline</Text>
              </>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [rs.acceptBtn, pressed && rs.btnPressed]}
            onPress={() => onAccept(item.id)}
            disabled={isAccepting || isDeclining}
            testID={`accept-ov-${item.id}`}
          >
            {isAccepting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Check size={16} color={Colors.white} />
                <Text style={rs.acceptText}>Accept</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      {isOpen && rem.text !== 'Expired' && !isStationary ? (
        <View style={rs.drivingNotice}>
          <Lock size={14} color={Colors.textSecondary} />
          <Text style={rs.drivingNoticeText}>
            Auto-handled while driving — stop at a station to manage manually
          </Text>
        </View>
      ) : null}

      {isAccepted ? (
        <Pressable
          style={({ pressed }) => [rs.navBtn, pressed && { opacity: 0.85 }]}
          onPress={() => onNavigate(item.lat, item.lng, item.pickup_stop ?? item.stop_name)}
          testID={`nav-ov-${item.id}`}
        >
          <Navigation size={16} color={Colors.white} />
          <Text style={rs.navText}>Navigate to Pickup</Text>
          <ArrowRight size={14} color={Colors.white} />
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const MemoizedRequestCard = React.memo(RequestCard);

function AutoAcceptBanner({ count, seatsLeft }: { count: number; seatsLeft: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.02, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <Animated.View style={[rs.autoAcceptBanner, { transform: [{ scale: pulseAnim }] }]}>
      <View style={rs.autoAcceptIconWrap}>
        <Zap size={20} color={Colors.white} />
      </View>
      <View style={rs.autoAcceptContent}>
        <Text style={rs.autoAcceptTitle}>Auto-Accept Mode Active</Text>
        <Text style={rs.autoAcceptSubtitle}>
          {count > 0
            ? `${count} booking${count !== 1 ? 's' : ''} auto-accepted · ${seatsLeft} seat${seatsLeft !== 1 ? 's' : ''} left`
            : `Bookings will be auto-accepted · ${seatsLeft} seat${seatsLeft !== 1 ? 's' : ''} available`}
        </Text>
      </View>
      <Route size={18} color={Colors.success} />
    </Animated.View>
  );
}

export default function TrotroOverflowRequests() {
  const qc = useQueryClient();
  const setOv = useBookingStore((s) => s.setOverflowRequests);
  const updateStatus = useBookingStore((s) => s.updateOverflowStatus);
  const drivingStatus = useDriverStore((s) => s.drivingStatus);
  const availableSeats = useDriverStore((s) => s.availableSeats);
  const autoAcceptedBookings = useDriverStore((s) => s.autoAcceptedBookings);
  const addAutoAccepted = useDriverStore((s) => s.addAutoAcceptedBooking);
  const isStationary = drivingStatus === 'STATIONARY';

  const oQ = useQuery({
    queryKey: ['overflow'],
    queryFn: getOverflowRequests,
    refetchInterval: 45000,
  });

  useEffect(() => {
    if (oQ.data) {
      setOv(oQ.data);
      triggerNotifications(oQ.data);
    }
  }, [oQ.data, setOv]);

  useEffect(() => {
    if (!isStationary && availableSeats > 0) {
      console.log('[Requests] En route mode — starting auto-accept polling');
      const interval = setInterval(async () => {
        try {
          const currentSeats = useDriverStore.getState().availableSeats;
          if (currentSeats <= 0) {
            console.log('[Requests] No seats left, skipping auto-accept');
            return;
          }
          const booking = await autoAcceptBooking(currentSeats);
          if (booking) {
            addAutoAccepted(booking);
            await sendAutoAcceptNotification(booking);
            if (Platform.OS !== 'web') {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            qc.invalidateQueries({ queryKey: ['dashboard'] });
            console.log('[Requests] Auto-accepted:', booking.passenger_name);
          }
        } catch (e) {
          console.log('[Requests] Auto-accept error:', e);
        }
      }, 15000);

      return () => {
        console.log('[Requests] Stopping auto-accept polling');
        clearInterval(interval);
      };
    }
  }, [isStationary, availableSeats, addAutoAccepted, qc]);

  const triggerNotifications = useCallback(async (requests: OverflowRequest[]) => {
    try {
      const newReqs = await checkForNewRequests(requests);
      if (newReqs.length === 0) return;

      const openCount = requests.filter((r) => r.status === 'OPEN').length;
      await setBadgeCount(openCount);

      if (newReqs.length === 1) {
        await sendLocalRequestNotification(newReqs[0]);
      } else if (newReqs.length <= 3) {
        for (const req of newReqs) {
          await sendLocalRequestNotification(req);
        }
      } else {
        await sendBatchRequestNotification(newReqs.length);
      }
    } catch (e) {
      console.log('[Requests] Notification trigger error:', e);
    }
  }, []);

  const acceptMut = useMutation({
    mutationFn: acceptOverflowRequest,
    onSuccess: (_d, id) => {
      console.log('[Requests] Overflow request accepted:', id);
      updateStatus(id, 'ACCEPTED');
      qc.invalidateQueries({ queryKey: ['overflow'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const req = oQ.data?.find((r) => r.id === id);
      if (req) sendRequestStatusNotification(id, 'ACCEPTED', req.stop_name);
      Alert.alert('Request Accepted', 'Navigate to the pickup stop to collect the passenger.');
    },
    onError: () => {
      Alert.alert('Error', 'Failed to accept request. Please try again.');
    },
  });

  const declineMut = useMutation({
    mutationFn: declineOverflowRequest,
    onSuccess: (_d, id) => {
      console.log('[Requests] Overflow request declined:', id);
      updateStatus(id, 'DECLINED');
      qc.invalidateQueries({ queryKey: ['overflow'] });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      const req = oQ.data?.find((r) => r.id === id);
      if (req) sendRequestStatusNotification(id, 'DECLINED', req.stop_name);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to decline request. Please try again.');
    },
  });

  const onAccept = useCallback(
    (id: string) => {
      if (!isStationary) {
        Alert.alert('Driving Mode', 'You must be stationary at a station or bus stop to manually accept requests.');
        return;
      }
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Accept Request?',
        'You will be expected to pick up this passenger at the stop.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Accept', onPress: () => acceptMut.mutate(id) },
        ],
      );
    },
    [acceptMut, isStationary],
  );

  const onDecline = useCallback(
    (id: string) => {
      if (!isStationary) {
        Alert.alert('Driving Mode', 'You must be stationary to manage requests manually.');
        return;
      }
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Alert.alert(
        'Decline Request?',
        'This request will be offered to other drivers.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Decline', style: 'destructive', onPress: () => declineMut.mutate(id) },
        ],
      );
    },
    [declineMut, isStationary],
  );

  const onNavigate = useCallback((lat: number, lng: number, stopName?: string) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: '/navigate', params: { lat: String(lat), lng: String(lng), name: stopName ?? 'Pickup' } });
  }, []);

  const sortedData = useMemo(() => {
    if (!oQ.data) return [];
    const open: OverflowRequest[] = [];
    const accepted: OverflowRequest[] = [];
    const rest: OverflowRequest[] = [];
    oQ.data.forEach((r) => {
      if (r.status === 'OPEN') open.push(r);
      else if (r.status === 'ACCEPTED') accepted.push(r);
      else rest.push(r);
    });
    return [...accepted, ...open, ...rest];
  }, [oQ.data]);

  const renderItem = useCallback(
    ({ item }: { item: OverflowRequest }) => (
      <MemoizedRequestCard
        item={item}
        onAccept={onAccept}
        onDecline={onDecline}
        onNavigate={onNavigate}
        isAccepting={acceptMut.isPending && acceptMut.variables === item.id}
        isDeclining={declineMut.isPending && declineMut.variables === item.id}
        isStationary={isStationary}
      />
    ),
    [onAccept, onDecline, onNavigate, acceptMut.isPending, acceptMut.variables, declineMut.isPending, declineMut.variables, isStationary],
  );

  const openCount = useMemo(() => sortedData.filter((r) => r.status === 'OPEN').length, [sortedData]);
  const acceptedCount = useMemo(() => sortedData.filter((r) => r.status === 'ACCEPTED').length, [sortedData]);

  const Header = useMemo(
    () => (
      <View>
        {!isStationary ? (
          <AutoAcceptBanner count={autoAcceptedBookings.length} seatsLeft={availableSeats} />
        ) : null}

        {sortedData.length > 0 ? (
          <View>
            <View style={rs.summaryRow}>
              {isStationary ? (
                <View style={rs.stationaryChip}>
                  <CircleStop size={12} color={Colors.primary} />
                  <Text style={rs.stationaryChipText}>Manual Mode</Text>
                </View>
              ) : null}
              {openCount > 0 ? (
                <View style={rs.summaryChip}>
                  <View style={rs.summaryDot} />
                  <Text style={rs.summaryText}>{openCount} new request{openCount !== 1 ? 's' : ''}</Text>
                </View>
              ) : null}
              {acceptedCount > 0 ? (
                <View style={[rs.summaryChip, rs.summaryChipGreen]}>
                  <CheckCircle size={12} color={Colors.success} />
                  <Text style={[rs.summaryText, rs.summaryTextGreen]}>{acceptedCount} accepted</Text>
                </View>
              ) : null}
            </View>
            {openCount > 0 && isStationary ? (
              <View style={rs.alertBanner}>
                <AlertTriangle size={18} color={Colors.warning} />
                <View style={rs.alertContent}>
                  <Text style={rs.alertTitle}>Passengers are waiting</Text>
                  <Text style={rs.alertSubtitle}>Accept individual passenger requests nearby</Text>
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    ),
    [sortedData.length, openCount, acceptedCount, isStationary, autoAcceptedBookings.length, availableSeats],
  );

  const Empty = useMemo(
    () =>
      oQ.isLoading ? (
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 60 }} />
      ) : (
        <View style={rs.empty}>
          <View style={rs.emptyIcon}>
            <Inbox size={36} color={Colors.disabled} />
          </View>
          <Text style={rs.emptyTitle}>No requests right now</Text>
          <Text style={rs.emptySubtitle}>
            {isStationary
              ? 'When passengers request rides nearby, they will appear here for you to accept.'
              : 'Bookings are being auto-accepted while you drive. New requests will appear when available.'}
          </Text>
        </View>
      ),
    [oQ.isLoading, isStationary],
  );

  return (
    <View style={rs.container}>
      <FlatList
        data={sortedData}
        renderItem={renderItem}
        keyExtractor={(i) => i.id}
        contentContainerStyle={rs.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={Header}
        ListEmptyComponent={Empty}
        refreshControl={
          <RefreshControl
            refreshing={oQ.isRefetching}
            onRefresh={() => qc.invalidateQueries({ queryKey: ['overflow'] })}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />
    </View>
  );
}

const rs = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: 16, paddingBottom: 32 },

  autoAcceptBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#66BB6A',
  },
  autoAcceptIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoAcceptContent: { flex: 1 },
  autoAcceptTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1B5E20',
    marginBottom: 2,
  },
  autoAcceptSubtitle: {
    fontSize: 13,
    color: '#388E3C',
    lineHeight: 18,
  },

  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  stationaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EBF4FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  stationaryChipText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF3E0',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  summaryChipGreen: {
    backgroundColor: '#E8F5E9',
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.warning,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#E65100',
  },
  summaryTextGreen: {
    color: Colors.success,
  },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.warning,
  },
  alertContent: { flex: 1 },
  alertTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  alertSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardAccepted: {
    borderColor: '#A5D6A7',
    borderWidth: 1.5,
    backgroundColor: '#FAFFF9',
  },
  cardDeclined: {
    opacity: 0.55,
  },
  cardDriving: {
    opacity: 0.7,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed' as const,
  },

  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  stopIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopInfo: { flex: 1 },
  stopName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  passengerName: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },

  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  timerUrgent: { backgroundColor: '#FFEBEE' },
  timerText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  timerTextUrgent: { color: Colors.error },

  routeContainer: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 12,
  },
  routeVisual: {
    alignItems: 'center',
    paddingTop: 2,
    width: 14,
  },
  routeDotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
  },
  routeLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 2,
  },
  routeDotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
  },
  routeLabels: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 8,
  },
  routeItem: { gap: 1 },
  routeLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textPrimary,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EBF4FF',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  metaChipTextIndividual: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  metaDist: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  metaAgo: {
    fontSize: 12,
    color: Colors.disabled,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.error,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  acceptBtn: {
    flex: 1.4,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.success,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  declineText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  acceptText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  btnPressed: { opacity: 0.7 },

  drivingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  drivingNoticeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    lineHeight: 17,
  },

  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  navText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },

  empty: {
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
