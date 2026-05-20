import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DemandPinProps {
  count: number;
}

function getDemandColor(count: number): string {
  if (count >= 5) return '#C62828';
  if (count >= 2) return '#F57C00';
  return '#2E7D32';
}

export const DemandPin = React.memo(function DemandPin({ count }: DemandPinProps) {
  const color = getDemandColor(count);
  return (
    <View style={[styles.pin, { backgroundColor: color }]}>
      <Text style={styles.pinText}>{count}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  pinText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700' as const,
  },
});
