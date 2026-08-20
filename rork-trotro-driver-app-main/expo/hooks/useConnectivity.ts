import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useDriverStore } from '@/store/driverStore';
import { useAuthStore } from '@/store/authStore';
import { isOfflineSyncEnabled } from '@/services/offlineFeatureFlag';
import {
  clearLocalSync,
  initializeLocalSync,
  migrateLegacyGpsQueue,
  subscribeSyncStatus,
  syncNow,
  getSyncStatus,
  type SyncStatus,
} from '@/services/localSync';

export function useConnectivity() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [syncStatus, setLocalSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const setOnlineStatus = useDriverStore((s) => s.setOnlineStatus);
  const setStoreSyncStatus = useDriverStore((s) => s.setSyncStatus);
  const userId = useAuthStore((s) => s.user?.id);
  const previousUserId = useRef<string | undefined>(undefined);
  const enabled = isOfflineSyncEnabled(userId);

  const syncIfPossible = useCallback(async (online: boolean) => {
    if (!enabled || !userId || !online) return;
    try {
      await migrateLegacyGpsQueue(userId);
      await syncNow(userId);
    } catch (err) {
      console.log('[Connectivity] Sync deferred:', err);
    }
  }, [enabled, userId]);

  const handleConnectivityChange = useCallback(
    (state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      console.log('[Connectivity] Online:', online);
      setIsConnected(online);
      setOnlineStatus(online);

      if (online) void syncIfPossible(true);
      else setLocalSyncStatus('offline');
    },
    [setOnlineStatus, syncIfPossible]
  );

  useEffect(() => {
    setStoreSyncStatus(enabled ? syncStatus : 'synced');
  }, [enabled, setStoreSyncStatus, syncStatus]);

  useEffect(() => {
    if (!enabled) return;
    const previous = previousUserId.current;
    if (previous && previous !== userId) void clearLocalSync(previous);
    previousUserId.current = userId;
    void initializeLocalSync();
    const unsubscribeSync = subscribeSyncStatus(setLocalSyncStatus);
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);
    NetInfo.fetch().then(handleConnectivityChange);
    return () => {
      unsubscribeSync();
      unsubscribe();
    };
  }, [enabled, handleConnectivityChange, userId]);

  useEffect(() => {
    if (enabled && userId && isConnected) void syncIfPossible(true);
  }, [enabled, isConnected, syncIfPossible, userId]);

  return { isConnected, syncStatus: enabled ? syncStatus : 'synced' };
}
