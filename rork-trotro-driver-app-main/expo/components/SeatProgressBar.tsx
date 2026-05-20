import React, { useRef, useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Platform, ScrollView, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { Minus, Plus, RefreshCw, ArrowDownCircle, ArrowUpCircle, Hash } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getSeatColor } from '@/utils/helpers';
import Colors from '@/constants/colors';
import { SeatEvent } from '@/types';

const DIAL_ITEM_HEIGHT = 48;
const DIAL_VISIBLE_ITEMS = 5;
const DIAL_HEIGHT = DIAL_ITEM_HEIGHT * DIAL_VISIBLE_ITEMS;

interface SeatProgressBarProps {
  available: number;
  total: number;
  onIncrement?: () => void;
  onDecrement?: () => void;
  onSeatSet?: (count: number) => void;
  disabled?: boolean;
  isSyncing?: boolean;
  hasSystemUpdate?: boolean;
  recentEvents?: SeatEvent[];
  lastSyncTime?: string | null;
  onDismissSync?: () => void;
}

export const SeatProgressBar = React.memo(function SeatProgressBar({
  available,
  total,
  onIncrement,
  onDecrement,
  onSeatSet,
  disabled = false,
  isSyncing = false,
  hasSystemUpdate = false,
  recentEvents = [],
  lastSyncTime,
  onDismissSync,
}: SeatProgressBarProps) {
  const filled = total > 0 ? ((total - available) / total) * 100 : 0;
  const barColor = getSeatColor(available, total);

  const [showDial, setShowDial] = useState<boolean>(false);
  const dialScrollRef = useRef<ScrollView>(null);
  const isDialScrolling = useRef<boolean>(false);
  const dialFade = useRef(new Animated.Value(0)).current;

  const scaleDown = useRef(new Animated.Value(1)).current;
  const scaleUp = useRef(new Animated.Value(1)).current;
  const syncPulse = useRef(new Animated.Value(1)).current;
  const updateGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSyncing) {
      const spin = Animated.loop(
        Animated.sequence([
          Animated.timing(syncPulse, { toValue: 0.7, duration: 600, useNativeDriver: true }),
          Animated.timing(syncPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      );
      spin.start();
      return () => spin.stop();
    }
  }, [isSyncing, syncPulse]);

  useEffect(() => {
    if (hasSystemUpdate) {
      Animated.sequence([
        Animated.timing(updateGlow, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.delay(2000),
        Animated.timing(updateGlow, { toValue: 0, duration: 500, useNativeDriver: false }),
      ]).start(() => {
        onDismissSync?.();
      });
    }
  }, [hasSystemUpdate, updateGlow, onDismissSync]);

  const animatePress = useCallback((scaleRef: Animated.Value) => {
    Animated.sequence([
      Animated.timing(scaleRef, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleRef, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleDecrement = useCallback(() => {
    if (disabled || available <= 0) return;
    animatePress(scaleDown);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onDecrement?.();
  }, [disabled, available, onDecrement, animatePress, scaleDown]);

  const handleIncrement = useCallback(() => {
    if (disabled || available >= total) return;
    animatePress(scaleUp);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onIncrement?.();
  }, [disabled, available, total, onIncrement, animatePress, scaleUp]);

  const canDecrement = available > 0 && !disabled;
  const canIncrement = available < total && !disabled;

  const toggleDial = useCallback(() => {
    if (disabled) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!showDial) {
      setShowDial(true);
      Animated.spring(dialFade, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }).start();
      setTimeout(() => {
        dialScrollRef.current?.scrollTo({
          y: available * DIAL_ITEM_HEIGHT,
          animated: false,
        });
      }, 50);
    } else {
      Animated.timing(dialFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setShowDial(false);
      });
    }
  }, [showDial, disabled, available, dialFade]);

  const onDialScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const index = Math.round(y / DIAL_ITEM_HEIGHT);
    const clampedIndex = Math.max(0, Math.min(total, index));
    dialScrollRef.current?.scrollTo({ y: clampedIndex * DIAL_ITEM_HEIGHT, animated: true });
    if (clampedIndex !== available && onSeatSet) {
      if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSeatSet(clampedIndex);
    }
    isDialScrolling.current = false;
  }, [total, available, onSeatSet]);

  const onDialItemPress = useCallback((value: number) => {
    if (disabled) return;
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    dialScrollRef.current?.scrollTo({ y: value * DIAL_ITEM_HEIGHT, animated: true });
    if (value !== available && onSeatSet) {
      onSeatSet(value);
    }
  }, [disabled, available, onSeatSet]);

  useEffect(() => {
    if (showDial && dialScrollRef.current && !isDialScrolling.current) {
      setTimeout(() => {
        dialScrollRef.current?.scrollTo({
          y: available * DIAL_ITEM_HEIGHT,
          animated: true,
        });
      }, 50);
    }
  }, [available, showDial]);

  const dialNumbers = Array.from({ length: total + 1 }, (_, i) => i);

  const borderColor = updateGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.borderLight, '#66BB6A'],
  });

  const systemEvents = recentEvents.filter((e) => e.source === 'SYSTEM').slice(0, 2);

  const formatEventTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { borderColor },
      ]}
      testID="seat-progress"
    >
      <View style={styles.headerRow}>
        <View style={styles.labelGroup}>
          <Text style={styles.label}>Seats Available</Text>
          {isSyncing ? (
            <Animated.View style={{ opacity: syncPulse }}>
              <RefreshCw size={12} color={Colors.primary} />
            </Animated.View>
          ) : null}
        </View>
        <Text style={[styles.count, { color: barColor }]}>
          {available} / {total}
        </Text>
      </View>

      <View style={styles.trackOuter}>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${filled}%`, backgroundColor: barColor },
            ]}
          />
        </View>
      </View>

      {(onIncrement || onDecrement) ? (
        <View style={styles.controlsRow}>
          <Animated.View style={{ transform: [{ scale: scaleDown }] }}>
            <Pressable
              onPress={handleDecrement}
              style={[
                styles.controlBtn,
                styles.decrementBtn,
                !canDecrement && styles.controlBtnDisabled,
              ]}
              disabled={!canDecrement}
              testID="seat-decrement"
            >
              <Minus size={18} color={canDecrement ? Colors.white : Colors.disabled} />
            </Pressable>
          </Animated.View>

          <Pressable onPress={toggleDial} style={styles.seatCountCenter} testID="seat-dial-toggle">
            <Text style={[styles.seatCountBig, { color: barColor }]}>{available}</Text>
            <View style={styles.dialToggleHint}>
              <Hash size={10} color={Colors.textSecondary} />
              <Text style={styles.dialToggleText}>Dial</Text>
            </View>
          </Pressable>

          <Animated.View style={{ transform: [{ scale: scaleUp }] }}>
            <Pressable
              onPress={handleIncrement}
              style={[
                styles.controlBtn,
                styles.incrementBtn,
                !canIncrement && styles.controlBtnDisabled,
              ]}
              disabled={!canIncrement}
              testID="seat-increment"
            >
              <Plus size={18} color={canIncrement ? Colors.white : Colors.disabled} />
            </Pressable>
          </Animated.View>
        </View>
      ) : null}

      {showDial ? (
        <Animated.View style={[styles.dialContainer, { opacity: dialFade, transform: [{ scale: dialFade.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }] }]} testID="seat-dial">
          <Text style={styles.dialLabel}>Scroll to set seats</Text>
          <View style={styles.dialWrapper}>
            <View style={styles.dialHighlight} pointerEvents="none" />
            <ScrollView
              ref={dialScrollRef}
              style={styles.dialScroll}
              contentContainerStyle={{ paddingVertical: DIAL_ITEM_HEIGHT * 2 }}
              showsVerticalScrollIndicator={false}
              snapToInterval={DIAL_ITEM_HEIGHT}
              decelerationRate="fast"
              onScrollBeginDrag={() => { isDialScrolling.current = true; }}
              onMomentumScrollEnd={onDialScrollEnd}
              onScrollEndDrag={(e) => {
                if (Platform.OS === 'web') {
                  onDialScrollEnd(e);
                }
              }}
            >
              {dialNumbers.map((num) => {
                const isSelected = num === available;
                return (
                  <Pressable
                    key={num}
                    onPress={() => onDialItemPress(num)}
                    style={styles.dialItem}
                  >
                    <Text style={[
                      styles.dialItemText,
                      isSelected && styles.dialItemTextActive,
                    ]}>
                      {num}
                    </Text>
                    {isSelected ? <View style={[styles.dialActiveDot, { backgroundColor: barColor }]} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <View style={styles.dialSeatRow}>
            {Array.from({ length: total }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.seatDot,
                  i < (total - available)
                    ? styles.seatDotOccupied
                    : styles.seatDotFree,
                ]}
              />
            ))}
          </View>
          <Pressable onPress={toggleDial} style={styles.dialCloseBtn} testID="seat-dial-close">
            <Text style={styles.dialCloseBtnText}>Done</Text>
          </Pressable>
        </Animated.View>
      ) : (
        <View style={styles.seatVisual}>
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              style={[
                styles.seatDot,
                i < (total - available)
                  ? styles.seatDotOccupied
                  : styles.seatDotFree,
              ]}
            />
          ))}
        </View>
      )}

      {systemEvents.length > 0 ? (
        <View style={styles.eventsContainer}>
          <View style={styles.eventsHeader}>
            <View style={styles.syncDot} />
            <Text style={styles.eventsTitle}>System Updates</Text>
          </View>
          {systemEvents.map((evt) => (
            <View key={evt.id} style={styles.eventRow}>
              {evt.type === 'BOARDING' ? (
                <ArrowDownCircle size={14} color={Colors.error} />
              ) : (
                <ArrowUpCircle size={14} color={Colors.success} />
              )}
              <Text style={styles.eventText} numberOfLines={1}>
                {evt.passenger_name ?? 'Passenger'} — {evt.type === 'BOARDING' ? 'boarded' : 'alighted'}
              </Text>
              <Text style={styles.eventTime}>{formatEventTime(evt.timestamp)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {(onIncrement || onDecrement) ? (
        <View style={styles.hintRow}>
          <Text style={styles.hint}>
            Tap − when a passenger boards, + when they alight
          </Text>
          {lastSyncTime ? (
            <View style={styles.syncBadge}>
              <RefreshCw size={10} color={Colors.primary} />
              <Text style={styles.syncText}>Auto-synced</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  count: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  trackOuter: {
    overflow: 'hidden',
    borderRadius: 8,
  },
  track: {
    height: 14,
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 8,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 12,
  },
  controlBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  decrementBtn: {
    backgroundColor: Colors.error,
    shadowColor: Colors.error,
  },
  incrementBtn: {
    backgroundColor: Colors.success,
    shadowColor: Colors.success,
  },
  controlBtnDisabled: {
    backgroundColor: '#E2E8F0',
    shadowOpacity: 0,
    elevation: 0,
  },
  seatCountCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 4,
  },
  seatCountBig: {
    fontSize: 32,
    fontWeight: '800' as const,
    lineHeight: 38,
  },
  dialToggleHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  dialToggleText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600' as const,
  },
  dialContainer: {
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  dialLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  dialWrapper: {
    height: DIAL_HEIGHT,
    width: 80,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dialHighlight: {
    position: 'absolute' as const,
    top: DIAL_ITEM_HEIGHT * 2,
    left: 0,
    right: 0,
    height: DIAL_ITEM_HEIGHT,
    backgroundColor: 'rgba(21, 101, 192, 0.08)',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: Colors.primary,
    zIndex: 1,
  },
  dialScroll: {
    flex: 1,
  },
  dialItem: {
    height: DIAL_ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dialItemText: {
    fontSize: 22,
    fontWeight: '500' as const,
    color: Colors.disabled,
  },
  dialItemTextActive: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.primary,
  },
  dialActiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dialSeatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  dialCloseBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 10,
  },
  dialCloseBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  seatVisual: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 4,
  },
  seatDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  seatDotOccupied: {
    backgroundColor: Colors.error,
    opacity: 0.7,
  },
  seatDotFree: {
    backgroundColor: Colors.success,
    opacity: 0.5,
  },
  eventsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  eventsTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textPrimary,
    fontWeight: '500' as const,
  },
  eventTime: {
    fontSize: 11,
    color: Colors.disabled,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  hint: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic' as const,
    flex: 1,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EBF4FF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  syncText: {
    fontSize: 10,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
