import { useCallback, useEffect, useState } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { useAuth } from '@/contexts/AuthContext';
import { initializeLocalSync, getSyncStatus, subscribeSyncStatus, syncNow, type SyncStatus } from '@/services/localSync';

export function useOfflineSync() {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(true);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());

  const syncIfPossible = useCallback(async (online: boolean) => {
    if (!user?.id || !online) return;
    try {
      await syncNow(user.id);
    } catch (error) {
      console.log('[OfflineSync] Passenger sync deferred:', error);
    }
  }, [user?.id]);

  const handleConnectivityChange = useCallback((state: NetInfoState) => {
    const online = state.isConnected === true && state.isInternetReachable !== false;
    setIsConnected(online);
    if (online) void syncIfPossible(true);
    else setSyncStatus('offline');
  }, [syncIfPossible]);

  useEffect(() => {
    void initializeLocalSync();
    const unsubscribeSync = subscribeSyncStatus(setSyncStatus);
    const unsubscribeNetInfo = NetInfo.addEventListener(handleConnectivityChange);
    NetInfo.fetch().then(handleConnectivityChange);
    return () => {
      unsubscribeSync();
      unsubscribeNetInfo();
    };
  }, [handleConnectivityChange]);

  useEffect(() => {
    if (user?.id && isConnected) void syncIfPossible(true);
  }, [isConnected, syncIfPossible, user?.id]);

  return { isConnected, syncStatus };
}
