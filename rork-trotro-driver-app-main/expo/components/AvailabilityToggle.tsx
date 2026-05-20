import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Colors from '@/constants/colors';

interface AvailabilityToggleProps {
  isAvailable: boolean;
  onToggle: (value: boolean) => void;
  disabled?: boolean;
}

export const AvailabilityToggle = React.memo(function AvailabilityToggle({
  isAvailable,
  onToggle,
  disabled = false,
}: AvailabilityToggleProps) {
  const animValue = useRef(new Animated.Value(isAvailable ? 1 : 0)).current;

  const handleToggle = useCallback(() => {
    if (disabled) return;
    const newValue = !isAvailable;
    Animated.spring(animValue, {
      toValue: newValue ? 1 : 0,
      useNativeDriver: false,
      tension: 60,
      friction: 8,
    }).start();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onToggle(newValue);
  }, [isAvailable, onToggle, disabled, animValue]);

  const backgroundColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#94A3B8', Colors.success],
  });

  const thumbTranslate = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [4, 196],
  });

  return (
    <Pressable onPress={handleToggle} disabled={disabled} testID="availability-toggle">
      <Animated.View style={[styles.track, { backgroundColor }]}>
        <View style={styles.labelContainer}>
          <Text style={[styles.label, !isAvailable && styles.labelActive]}>
            UNAVAILABLE
          </Text>
          <Text style={[styles.label, isAvailable && styles.labelActive]}>
            AVAILABLE
          </Text>
        </View>
        <Animated.View
          style={[
            styles.thumb,
            { transform: [{ translateX: thumbTranslate }] },
          ]}
        >
          <View style={styles.thumbInner} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  track: {
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 1,
  },
  labelActive: {
    color: '#FFFFFF',
  },
  thumb: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  thumbInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#CBD5E1',
  },
});
