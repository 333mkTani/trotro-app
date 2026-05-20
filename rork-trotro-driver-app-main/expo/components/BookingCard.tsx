import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { MapPin, Clock, User, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';
import { Booking } from '@/types';
import { formatTime } from '@/utils/helpers';

interface BookingCardProps {
  booking: Booking;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  isOnline: boolean;
}

const statusColors: Record<string, { bg: string; text: string }> = {
  PENDING: { bg: '#FFF3E0', text: '#F57C00' },
  CONFIRMED: { bg: '#E8F5E9', text: '#2E7D32' },
  COMPLETED: { bg: '#EBF4FF', text: '#1565C0' },
  DECLINED: { bg: '#FFEBEE', text: '#C62828' },
  CANCELLED: { bg: '#F5F5F5', text: '#64748B' },
};

export const BookingCard = React.memo(function BookingCard({
  booking,
  onAccept,
  onDecline,
  isOnline,
}: BookingCardProps) {
  const colors = statusColors[booking.status] || statusColors.PENDING;

  const handleAccept = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onAccept?.(booking.id);
  }, [booking.id, onAccept]);

  const handleDecline = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDecline?.(booking.id);
  }, [booking.id, onDecline]);

  return (
    <View style={styles.card} testID="booking-card">
      <View style={styles.header}>
        <View style={styles.passengerRow}>
          <View style={styles.avatarWrap}>
            <User size={16} color={Colors.primary} />
          </View>
          <Text style={styles.passengerName}>{booking.passenger_name}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: colors.bg }]}>
          <Text style={[styles.badgeText, { color: colors.text }]}>
            {booking.status}
          </Text>
        </View>
      </View>

      <View style={styles.routeSection}>
        <View style={styles.routeRow}>
          <View style={styles.dotGreen} />
          <Text style={styles.stopText}>{booking.pickup_stop}</Text>
        </View>
        <View style={styles.routeLine} />
        <View style={styles.routeRow}>
          <View style={styles.dotRed} />
          <Text style={styles.stopText}>{booking.destination_stop}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Clock size={14} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{formatTime(booking.desired_arrival_time)}</Text>
        </View>
        <View style={styles.metaItem}>
          <ChevronRight size={14} color={Colors.textSecondary} />
          <Text style={styles.metaText}>{booking.buffer_minutes} min buffer</Text>
        </View>
      </View>

      {booking.status === 'PENDING' && (
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.declineBtn,
              pressed && styles.btnPressed,
              !isOnline && styles.btnDisabled,
            ]}
            onPress={handleDecline}
            disabled={!isOnline}
            testID="decline-btn"
          >
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.acceptBtn,
              pressed && styles.btnPressed,
              !isOnline && styles.btnDisabled,
            ]}
            onPress={handleAccept}
            disabled={!isOnline}
            testID="accept-btn"
          >
            <Text style={styles.acceptText}>Accept</Text>
          </Pressable>
        </View>
      )}

      {!isOnline && booking.status === 'PENDING' && (
        <Text style={styles.offlineHint}>Reconnect to accept bookings</Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  passengerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textPrimary,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  routeSection: {
    paddingLeft: 4,
    marginBottom: 14,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dotGreen: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
  },
  dotRed: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.error,
  },
  routeLine: {
    width: 2,
    height: 16,
    backgroundColor: '#E2E8F0',
    marginLeft: 4,
    marginVertical: 2,
  },
  stopText: {
    fontSize: 14,
    color: Colors.textPrimary,
    fontWeight: '500' as const,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: Colors.textSecondary,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
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
  btnPressed: {
    opacity: 0.7,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  offlineHint: {
    fontSize: 12,
    color: Colors.warning,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic' as const,
  },
});
