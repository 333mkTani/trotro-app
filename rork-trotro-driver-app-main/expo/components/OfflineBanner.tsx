import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface OfflineBannerProps {
  visible: boolean;
}

export const OfflineBanner = React.memo(function OfflineBanner({ visible }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <View style={styles.container} testID="offline-banner">
      <WifiOff size={16} color={Colors.offlineText} />
      <Text style={styles.text}>You are offline. GPS updates are queued.</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.offlineBg,
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    fontSize: 13,
    color: Colors.offlineText,
    fontWeight: '500' as const,
  },
});
