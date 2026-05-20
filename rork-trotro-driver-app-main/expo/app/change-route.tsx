import React, { useCallback, useRef, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, Animated, ActivityIndicator, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Stack } from 'expo-router';
import { MapPin, ArrowRight, Clock, Ruler, TrendingUp, ShieldAlert, CheckCircle, AlertTriangle, CircleDot } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { useDriverStore } from '@/store/driverStore';
import { useBookingStore } from '@/store/bookingStore';
import { getAvailableRoutes, changeRoute } from '@/services/driverApi';
import { AvailableRoute } from '@/types';

const DEMAND_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  HIGH: { color: '#C62828', bg: '#FFEBEE', label: 'High Demand' },
  MEDIUM: { color: '#E65100', bg: '#FFF3E0', label: 'Moderate' },
  LOW: { color: '#558B2F', bg: '#F1F8E9', label: 'Low' },
};

export default function ChangeRouteScreen() {
  const qc = useQueryClient();
  const store = useDriverStore();
  const bookings = useBookingStore((s) => s.upcomingBookings);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const eligibility = useMemo(() => {
    const reasons: string[] = [];

    if (store.isAvailable) {
      reasons.push('You must set yourself as unavailable before changing routes.');
    }

    if (store.drivingStatus === 'EN_ROUTE') {
      reasons.push('You are currently en route. Stop driving first.');
    }

    const passengersOnboard = store.availableSeats < store.totalSeats;
    if (passengersOnboard) {
      reasons.push(`${store.totalSeats - store.availableSeats} passenger(s) still onboard.`);
    }

    const activeBookings = bookings.filter(
      (b) => b.status === 'PENDING' || b.status === 'CONFIRMED'
    );
    if (activeBookings.length > 0) {
      reasons.push(`${activeBookings.length} active booking(s) need to be completed or cancelled.`);
    }

    if (store.autoAcceptedBookings.length > 0) {
      reasons.push('Auto-accepted passengers are pending pickup.');
    }

    return { canChange: reasons.length === 0, reasons };
  }, [store.isAvailable, store.drivingStatus, store.availableSeats, store.totalSeats, bookings, store.autoAcceptedBookings]);

  const routesQ = useQuery({
    queryKey: ['available-routes'],
    queryFn: getAvailableRoutes,
    enabled: eligibility.canChange,
  });

  const changeMut = useMutation({
    mutationFn: changeRoute,
    onSuccess: (newRoute) => {
      console.log('[ChangeRoute] Route changed successfully to:', newRoute.name);
      store.setRoute(newRoute);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      Alert.alert('Route Changed', `You are now assigned to:\n${newRoute.name}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to change route. Please try again.');
    },
  });

  const onSelectRoute = useCallback(
    (route: AvailableRoute) => {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Confirm Route Change',
        `Switch from:\n${store.assignedRoute?.name ?? 'No route'}\n\nTo:\n${route.name}\n\nThis will notify the system and update your assignment.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Confirm',
            style: 'destructive',
            onPress: () => changeMut.mutate(route.id),
          },
        ]
      );
    },
    [store.assignedRoute, changeMut]
  );

  const renderRouteCard = useCallback(
    (route: AvailableRoute, index: number) => {
      const demand = DEMAND_CONFIG[route.demand_level];
      const itemFade = new Animated.Value(0);
      Animated.timing(itemFade, {
        toValue: 1,
        duration: 300,
        delay: index * 80,
        useNativeDriver: true,
      }).start();

      return (
        <Animated.View key={route.id} style={{ opacity: itemFade, transform: [{ translateY: itemFade.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
          <Pressable
            style={({ pressed }) => [s.routeCard, pressed && s.routeCardPressed]}
            onPress={() => onSelectRoute(route)}
            disabled={changeMut.isPending}
            testID={`route-${route.id}`}
          >
            <View style={s.routeHeader}>
              <View style={s.routeStops}>
                <View style={s.stopRow}>
                  <CircleDot size={14} color={Colors.primary} />
                  <Text style={s.stopText}>{route.origin}</Text>
                </View>
                <View style={s.routeLine} />
                <View style={s.stopRow}>
                  <MapPin size={14} color={Colors.error} />
                  <Text style={s.stopText}>{route.destination}</Text>
                </View>
              </View>
              <View style={[s.demandBadge, { backgroundColor: demand.bg }]}>
                <TrendingUp size={12} color={demand.color} />
                <Text style={[s.demandText, { color: demand.color }]}>{demand.label}</Text>
              </View>
            </View>

            <View style={s.routeMeta}>
              <View style={s.metaItem}>
                <Ruler size={13} color={Colors.textSecondary} />
                <Text style={s.metaText}>{route.distance_km} km</Text>
              </View>
              <View style={s.metaDot} />
              <View style={s.metaItem}>
                <Clock size={13} color={Colors.textSecondary} />
                <Text style={s.metaText}>{route.estimated_duration_min} min</Text>
              </View>
            </View>

            <View style={s.selectRow}>
              <Text style={s.selectText}>Tap to switch</Text>
              <ArrowRight size={16} color={Colors.primary} />
            </View>
          </Pressable>
        </Animated.View>
      );
    },
    [onSelectRoute, changeMut.isPending]
  );

  return (
    <>
      <Stack.Screen options={{ title: 'Change Route' }} />
      <Animated.View style={[s.container, { opacity: fadeAnim }]}>
        {/* Current Route */}
        <View style={s.currentCard}>
          <Text style={s.currentLabel}>CURRENT ROUTE</Text>
          {store.assignedRoute ? (
            <View style={s.currentRoute}>
              <View style={s.currentStops}>
                <CircleDot size={16} color={Colors.white} />
                <Text style={s.currentText}>{store.assignedRoute.origin}</Text>
                <ArrowRight size={16} color="rgba(255,255,255,0.6)" />
                <Text style={s.currentText}>{store.assignedRoute.destination}</Text>
              </View>
              <Text style={s.currentName}>{store.assignedRoute.name}</Text>
            </View>
          ) : (
            <Text style={s.currentNone}>No route assigned</Text>
          )}
        </View>

        {!eligibility.canChange ? (
          <View style={s.blockedCard}>
            <View style={s.blockedHeader}>
              <ShieldAlert size={22} color={Colors.error} />
              <Text style={s.blockedTitle}>Route Change Unavailable</Text>
            </View>
            <Text style={s.blockedDesc}>
              You cannot change your route right now. Resolve the following before switching:
            </Text>
            {eligibility.reasons.map((reason, i) => (
              <View key={i} style={s.reasonRow}>
                <AlertTriangle size={14} color={Colors.warning} />
                <Text style={s.reasonText}>{reason}</Text>
              </View>
            ))}
            <Pressable
              style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
              onPress={() => router.back()}
              testID="back-btn"
            >
              <Text style={s.backBtnText}>Go Back</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={s.eligibleBanner}>
              <CheckCircle size={18} color={Colors.success} />
              <Text style={s.eligibleText}>You're eligible to change routes</Text>
            </View>

            <Text style={s.sectionTitle}>Available Routes</Text>

            {routesQ.isLoading ? (
              <View style={s.loadingWrap}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={s.loadingText}>Loading routes...</Text>
              </View>
            ) : routesQ.isError ? (
              <View style={s.errorWrap}>
                <Text style={s.errorText}>Failed to load routes</Text>
                <Pressable
                  style={({ pressed }) => [s.retryBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => routesQ.refetch()}
                >
                  <Text style={s.retryText}>Retry</Text>
                </Pressable>
              </View>
            ) : routesQ.data && routesQ.data.length > 0 ? (
              routesQ.data.map((route, index) => renderRouteCard(route, index))
            ) : (
              <View style={s.emptyWrap}>
                <MapPin size={32} color={Colors.disabled} />
                <Text style={s.emptyText}>No other routes available</Text>
              </View>
            )}
          </ScrollView>
        )}

        {changeMut.isPending && (
          <View style={s.overlay}>
            <View style={s.overlayCard}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={s.overlayText}>Switching route...</Text>
            </View>
          </View>
        )}
      </Animated.View>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  currentCard: {
    backgroundColor: Colors.primary,
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    padding: 18,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  currentLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  currentRoute: {
    gap: 6,
  },
  currentStops: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  currentName: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500' as const,
  },
  currentNone: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    fontStyle: 'italic' as const,
  },
  blockedCard: {
    margin: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  blockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.error,
  },
  blockedDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  reasonText: {
    fontSize: 14,
    color: Colors.textPrimary,
    flex: 1,
    lineHeight: 20,
  },
  backBtn: {
    marginTop: 20,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  eligibleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E8F5E9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  eligibleText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  routeCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  routeCardPressed: {
    backgroundColor: '#F0F7FF',
    borderColor: Colors.primary,
  },
  routeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  routeStops: {
    flex: 1,
    gap: 4,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stopText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  routeLine: {
    width: 1,
    height: 12,
    backgroundColor: Colors.borderLight,
    marginLeft: 7,
  },
  demandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  demandText: {
    fontSize: 11,
    fontWeight: '700' as const,
  },
  routeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.disabled,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  selectText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  errorWrap: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  errorText: {
    fontSize: 15,
    color: Colors.error,
    fontWeight: '600' as const,
  },
  retryBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  overlayText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
});
