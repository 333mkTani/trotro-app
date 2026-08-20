import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useDriverStore } from '@/store/driverStore';
import { useAuthStore } from '@/store/authStore';
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const setOnlineStatus = useDriverStore((s) => s.setOnlineStatus);
  const userId = useAuthStore((s) => s.user?.id);
  const previousUserId = useRef<string | undefined>(undefined);

  const syncIfPossible = useCallback(async (online: boolean) => {
    if (!userId || !online) return;
    try {
      await migrateLegacyGpsQueue(userId);
      await syncNow(userId);
    } catch (err) {
      console.log('[Connectivity] Sync deferred:', err);
    }
  }, [userId]);

  const handleConnectivityChange = useCallback(
    (state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      console.log('[Connectivity] Online:', online);
      setIsConnected(online);
      setOnlineStatus(online);

      if (online) void syncIfPossible(true);
      else setSyncStatus('offline');
    },
    [setOnlineStatus, syncIfPossible]
  );

  useEffect(() => {
    const previous = previousUserId.current;
    if (previous && previous !== userId) void clearLocalSync(previous);
    previousUserId.current = userId;
    void initializeLocalSync();
    const unsubscribeSync = subscribeSyncStatus(setSyncStatus);
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);
    NetInfo.fetch().then(handleConnectivityChange);
    return () => {
      unsubscribeSync();
      unsubscribe();
    };
  }, [handleConnectivityChange, userId]);

  useEffect(() => {
    if (userId && isConnected) void syncIfPossible(true);
  }, [isConnected, syncIfPossible, userId]);

  return { isConnected, syncStatus };
}
