import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import Colors from '@/constants/colors';

interface OfflineBannerProps {
  visible: boolean;
  syncStatus?: 'offline' | 'stale' | 'pending' | 'syncing' | 'synced' | 'conflict';
}

export const OfflineBanner = React.memo(function OfflineBanner({ visible, syncStatus = 'offline' }: OfflineBannerProps) {
  if (!visible && !['pending', 'syncing', 'conflict'].includes(syncStatus)) return null;

  const isConflict = syncStatus === 'conflict';
  const isPending = syncStatus === 'pending' || syncStatus === 'syncing';

  return (
    <View style={styles.container} testID="offline-banner">
      <WifiOff size={16} color={isConflict ? Colors.error : Colors.offlineText} />
      <Text style={[styles.text, isConflict && styles.conflictText]}>
        {isConflict
          ? 'A queued driver update needs attention. Check your connection and retry.'
          : visible
            ? 'You are offline. GPS and safe driver updates are queued.'
            : isPending
              ? 'Syncing queued driver updates…'
              : 'Some queued driver updates need attention.'}
      </Text>
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
  conflictText: {
    color: Colors.error,
  },
});
