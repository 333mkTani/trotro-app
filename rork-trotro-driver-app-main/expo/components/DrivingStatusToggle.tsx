import React, { useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { CircleStop, Route } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { DrivingStatus } from '@/types';

interface DrivingStatusToggleProps {
  status: DrivingStatus;
  onToggle: (status: DrivingStatus) => void;
  availableSeats: number;
  disabled?: boolean;
}

export const DrivingStatusToggle = React.memo(function DrivingStatusToggle({
  status,
  onToggle,
  availableSeats,
  disabled = false,
}: DrivingStatusToggleProps) {
  const isStationary = status === 'STATIONARY';
  const slideAnim = useRef(new Animated.Value(isStationary ? 0 : 1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isStationary ? 0 : 1,
      useNativeDriver: false,
      tension: 65,
      friction: 10,
    }).start();
  }, [isStationary, slideAnim]);

  useEffect(() => {
    if (!isStationary) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isStationary, pulseAnim]);

  const handlePress = useCallback(
    (newStatus: DrivingStatus) => {
      if (disabled || newStatus === status) return;
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      onToggle(newStatus);
    },
    [disabled, status, onToggle],
  );

  const indicatorLeft = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['2%', '50%'],
  });

  const indicatorBg = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#1565C0', '#2E7D32'],
  });

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={styles.title}>Driving Mode</Text>
        <Animated.View
          style={[
            styles.liveIndicator,
            !isStationary && { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={[styles.liveDot, !isStationary ? styles.liveDotActive : styles.liveDotIdle]} />
          <Text style={[styles.liveText, !isStationary && styles.liveTextActive]}>
            {isStationary ? 'At Station' : 'On the Road'}
          </Text>
        </Animated.View>
      </View>

      <View style={styles.track}>
        <Animated.View
          style={[
            styles.indicator,
            { left: indicatorLeft, backgroundColor: indicatorBg },
          ]}
        />
        <Pressable
          style={styles.option}
          onPress={() => handlePress('STATIONARY')}
          disabled={disabled}
          testID="status-stationary"
        >
          <CircleStop size={18} color={isStationary ? Colors.white : Colors.textSecondary} />
          <Text style={[styles.optionText, isStationary && styles.optionTextActive]}>
            Stationary
          </Text>
        </Pressable>
        <Pressable
          style={styles.option}
          onPress={() => handlePress('EN_ROUTE')}
          disabled={disabled}
          testID="status-enroute"
        >
          <Route size={18} color={!isStationary ? Colors.white : Colors.textSecondary} />
          <Text style={[styles.optionText, !isStationary && styles.optionTextActive]}>
            En Route
          </Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        {isStationary
          ? 'You can manually accept or decline ride requests'
          : `Bookings auto-accepted when seats available (${availableSeats} left)`}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.textPrimary,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveDotIdle: {
    backgroundColor: Colors.primary,
  },
  liveDotActive: {
    backgroundColor: Colors.success,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  liveTextActive: {
    color: Colors.success,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    height: 52,
    position: 'relative',
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    width: '48%',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  optionTextActive: {
    color: Colors.white,
  },
  hint: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 17,
  },
});
