import { useState, useEffect, useCallback } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { useDriverStore } from '@/store/driverStore';
import { flushQueue } from '@/services/offlineQueue';

export function useConnectivity() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const setOnlineStatus = useDriverStore((s) => s.setOnlineStatus);

  const handleConnectivityChange = useCallback(
    (state: NetInfoState) => {
      const online = state.isConnected === true && state.isInternetReachable !== false;
      console.log('[Connectivity] Online:', online);
      setIsConnected(online);
      setOnlineStatus(online);

      if (online) {
        flushQueue().catch((err) =>
          console.log('[Connectivity] Failed to flush queue on reconnect:', err)
        );
      }
    },
    [setOnlineStatus]
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);
    NetInfo.fetch().then(handleConnectivityChange);
    return () => unsubscribe();
  }, [handleConnectivityChange]);

  return { isConnected };
}
