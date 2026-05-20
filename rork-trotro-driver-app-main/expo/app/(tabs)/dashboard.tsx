import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, RefreshControl, Animated, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { MapPin, TrendingUp, Clock, Route as RouteIcon, Navigation, Map, Crown, Users, Repeat } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useDriverStore } from '@/store/driverStore';
import { useAuthStore } from '@/store/authStore';
import { getDashboard, toggleAvailability, getDemandHeatmap, updateDrivingStatus, updateSeatCount } from '@/services/driverApi';
import { useSeatSync } from '@/hooks/useSeatSync';
import { AvailabilityToggle } from '@/components/AvailabilityToggle';
import { SeatProgressBar } from '@/components/SeatProgressBar';
import { StatCard } from '@/components/StatCard';
import { DrivingStatusToggle } from '@/components/DrivingStatusToggle';
import { DemandStop as DStop, DrivingStatus, AutoAcceptedBooking } from '@/types';

export default function TrotroDriverDashboard() {
  const qc = useQueryClient();
  const store = useDriverStore();
  const user = useAuthStore((s) => s.user);

  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start(); }, [fade]);

  const dashQ = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, refetchInterval: 60000, retry: 2 });
  const demandQ = useQuery({ queryKey: ['demand-heatmap'], queryFn: () => getDemandHeatmap(5000), refetchInterval: 120000, retry: 1 });
  useEffect(() => {
    if (dashQ.data) {
      const d = dashQ.data;
      store.setDashboardData({ isAvailable: d.is_available, availableSeats: d.available_seats, totalSeats: d.total_seats, assignedRoute: d.assigned_route, pendingBookingCount: d.pending_booking_count, demandScore: d.demand_score, todaysTrips: d.todays_trips, driverName: d.driver_name, busRegistration: d.bus_registration, schedulingHours: d.scheduling_hours });
    }
  }, [dashQ.data]);

  const availMut = useMutation({ mutationFn: toggleAvailability, onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard'] }), onError: () => Alert.alert('Error', 'Failed to update availability.') });
  const onToggle = useCallback((v: boolean) => { store.setAvailability(v); availMut.mutate(v); }, [store, availMut]);

  const drivingMut = useMutation({
    mutationFn: updateDrivingStatus,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: () => Alert.alert('Error', 'Failed to update driving status.'),
  });

  const seatMut = useMutation({
    mutationFn: ({ available, total }: { available: number; total: number }) => updateSeatCount(available, total),
    onSuccess: (data) => {
      store.updateSeats(data.available, data.total);
      console.log('[Dashboard] Seat count updated:', data.available, '/', data.total);
    },
    onError: () => Alert.alert('Error', 'Failed to update seat count.'),
  });

  const onSeatDecrement = useCallback(() => {
    const newAvailable = Math.max(0, store.availableSeats - 1);
    store.updateSeats(newAvailable, store.totalSeats);
    seatMut.mutate({ available: newAvailable, total: store.totalSeats });
  }, [store, seatMut]);

  const onSeatIncrement = useCallback(() => {
    const newAvailable = Math.min(store.totalSeats, store.availableSeats + 1);
    store.updateSeats(newAvailable, store.totalSeats);
    seatMut.mutate({ available: newAvailable, total: store.totalSeats });
  }, [store, seatMut]);

  const onSeatSet = useCallback((count: number) => {
    const clamped = Math.max(0, Math.min(store.totalSeats, count));
    console.log('[Dashboard] Seat dial set to:', clamped);
    store.updateSeats(clamped, store.totalSeats);
    seatMut.mutate({ available: clamped, total: store.totalSeats });
  }, [store, seatMut]);

  const onDrivingStatusToggle = useCallback((status: DrivingStatus) => {
    if (status === 'EN_ROUTE' && store.availableSeats <= 0) {
      Alert.alert('No Seats Available', 'You have no available seats. Bookings cannot be auto-accepted while driving.');
    }
    if (status === 'EN_ROUTE') {
      Alert.alert(
        'Start Driving?',
        'Switching to En Route mode will auto-accept bookings based on available seats. You won\'t be able to manually accept or decline until you stop.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Start Driving',
            onPress: () => {
              store.setDrivingStatus(status);
              store.clearAutoAcceptedBookings();
              drivingMut.mutate(status);
            },
          },
        ],
      );
    } else {
      store.setDrivingStatus(status);
      drivingMut.mutate(status);
      if (store.autoAcceptedBookings.length > 0) {
        Alert.alert(
          'Trip Summary',
          `${store.autoAcceptedBookings.length} booking${store.autoAcceptedBookings.length !== 1 ? 's' : ''} were auto-accepted during this trip.`,
        );
      }
    }
  }, [store, drivingMut]);

  const onRefresh = useCallback(() => { qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['demand-heatmap'] }); }, [qc]);
  const topStops = useMemo(() => demandQ.data ? [...demandQ.data].sort((a, b) => b.demand_count - a.demand_count).slice(0, 3) : [], [demandQ.data]);

  const seatSync = useSeatSync(store.isAvailable);

  const recentAutoBookings = store.autoAcceptedBookings.slice(-3);

  return (
    <Animated.View style={[ds.container, { opacity: fade }]}>
      <ScrollView style={ds.scroll} contentContainerStyle={ds.scrollPad} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={dashQ.isRefetching} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}>
        <View style={ds.headerCard}>
          <View style={ds.headerL}>
            <Text style={ds.driverName}>{store.driverName || user?.full_name || 'Driver'}</Text>
            <Text style={ds.busReg}>{store.busRegistration || 'N/A'}</Text>
          </View>
        </View>

        <View style={ds.sec}>
          <AvailabilityToggle isAvailable={store.isAvailable} onToggle={onToggle} disabled={availMut.isPending} />
        </View>

        {store.isAvailable ? (
          <View style={ds.sec}>
            <DrivingStatusToggle
              status={store.drivingStatus}
              onToggle={onDrivingStatusToggle}
              availableSeats={store.availableSeats}
              disabled={drivingMut.isPending}
            />
          </View>
        ) : null}

        <View style={ds.sec}>
          <SeatProgressBar
            available={store.availableSeats}
            total={store.totalSeats}
            onDecrement={onSeatDecrement}
            onIncrement={onSeatIncrement}
            onSeatSet={onSeatSet}
            disabled={seatMut.isPending}
            isSyncing={seatSync.isSyncing}
            hasSystemUpdate={seatSync.hasSystemUpdate}
            recentEvents={seatSync.recentEvents}
            lastSyncTime={seatSync.lastSyncTime}
            onDismissSync={seatSync.clearSystemFlag}
          />
        </View>

        {store.drivingStatus === 'EN_ROUTE' && recentAutoBookings.length > 0 ? (
          <View style={ds.autoCard}>
            <View style={ds.autoHeader}>
              <Users size={16} color={Colors.success} />
              <Text style={ds.autoTitle}>Auto-Accepted Passengers</Text>
              <View style={ds.autoCountBadge}>
                <Text style={ds.autoCountText}>{store.autoAcceptedBookings.length}</Text>
              </View>
            </View>
            {recentAutoBookings.map((b: AutoAcceptedBooking) => (
              <View key={b.id} style={ds.autoRow}>
                <View style={ds.autoDot} />
                <View style={ds.autoInfo}>
                  <Text style={ds.autoName}>{b.passenger_name}</Text>
                  <Text style={ds.autoRoute}>{b.pickup_stop} → {b.destination_stop}</Text>
                </View>
              </View>
            ))}
            {store.autoAcceptedBookings.length > 3 ? (
              <Text style={ds.autoMore}>+{store.autoAcceptedBookings.length - 3} more</Text>
            ) : null}
          </View>
        ) : null}

        <View style={ds.grid}>
          <View style={ds.row}>
            <StatCard icon={<Clock size={20} color={Colors.primary} />} value={store.todaysTrips} label="Today's Trips" />
            <StatCard icon={<TrendingUp size={20} color={Colors.warning} />} value={store.pendingBookingCount} label="Pending" />
          </View>
          <View style={ds.row}>
            <StatCard icon={<MapPin size={20} color={Colors.error} />} value={store.demandScore} label="Demand" />
            <StatCard icon={<RouteIcon size={20} color={Colors.success} />} value={store.assignedRoute?.name ?? '\u2014'} label="Route" />
          </View>
          <Pressable
            style={({ pressed }) => [ds.changeRouteBtn, pressed && { opacity: 0.7 }]}
            onPress={() => router.push('/change-route')}
            testID="change-route-btn"
          >
            <Repeat size={15} color={Colors.primary} />
            <Text style={ds.changeRouteBtnT}>Change Route</Text>
          </Pressable>
        </View>

        <View style={ds.demandCard}>
          <View style={ds.demandH}>
            <Text style={ds.secTitle}>High Demand Nearby</Text>
            <Pressable onPress={() => { if (store.isProSubscriber) { router.push('/demand-map'); } else { router.push('/pro-subscription'); } }} style={({ pressed }) => [ds.mapBtn, pressed && { opacity: 0.7 }]} testID="view-map-btn">
              {!store.isProSubscriber && <Crown size={12} color="#F59E0B" />}
              <Map size={14} color={Colors.primary} />
              <Text style={ds.mapBtnT}>{store.isProSubscriber ? 'View Map' : 'Pro'}</Text>
            </Pressable>
          </View>
          {topStops.length === 0 ? (
            <View style={ds.emptyD}><MapPin size={24} color={Colors.disabled} /><Text style={ds.emptyDT}>No high demand stops nearby</Text></View>
          ) : topStops.map((stop: DStop) => (
            <View key={stop.id} style={ds.demandRow}>
              <View style={ds.demandInfo}><Text style={ds.stopN}>{stop.stop_name}</Text><View style={ds.badge}><Text style={ds.badgeT}>{stop.demand_count}</Text></View></View>
              <Pressable style={({ pressed }) => [ds.navBtn, pressed && { opacity: 0.7 }]} onPress={() => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }} testID={`nav-${stop.id}`}><Navigation size={14} color={Colors.white} /><Text style={ds.navBtnT}>Navigate</Text></Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const ds = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollPad: { padding: 16, paddingBottom: 32 },
  headerCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, borderRadius: 16, padding: 18, marginBottom: 20, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  headerL: { flex: 1 },
  driverName: { fontSize: 20, fontWeight: '700' as const, color: Colors.white, marginBottom: 2 },
  busReg: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' as const },
  sec: { marginBottom: 20 },
  grid: { gap: 10, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 10 },

  autoCard: {
    backgroundColor: '#F0FFF4',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#A5D6A7',
  },
  autoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  autoTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    flex: 1,
  },
  autoCountBadge: {
    backgroundColor: Colors.success,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  autoCountText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  autoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#C8E6C9',
  },
  autoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  autoInfo: { flex: 1 },
  autoName: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  autoRoute: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  autoMore: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic' as const,
  },

  changeRouteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#EBF4FF',
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  changeRouteBtnT: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  demandCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.borderLight },
  demandH: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  secTitle: { fontSize: 17, fontWeight: '700' as const, color: Colors.textPrimary },
  mapBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#EBF4FF' },
  mapBtnT: { fontSize: 13, fontWeight: '600' as const, color: Colors.primary },
  emptyD: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyDT: { fontSize: 14, color: Colors.textSecondary },
  demandRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  demandInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  stopN: { fontSize: 15, fontWeight: '500' as const, color: Colors.textPrimary, flex: 1 },
  badge: { backgroundColor: '#FFEBEE', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeT: { fontSize: 13, fontWeight: '700' as const, color: Colors.error },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginLeft: 10 },
  navBtnT: { fontSize: 12, fontWeight: '600' as const, color: Colors.white },
});
