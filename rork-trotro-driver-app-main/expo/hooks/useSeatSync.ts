import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fetchSeatSync } from '@/services/driverApi';
import { useDriverStore } from '@/store/driverStore';
import { SeatEvent, SeatSyncData } from '@/types';

interface UseSeatSyncReturn {
  isSyncing: boolean;
  lastSyncTime: string | null;
  recentEvents: SeatEvent[];
  hasSystemUpdate: boolean;
  clearSystemFlag: () => void;
}

export function useSeatSync(enabled: boolean = true): UseSeatSyncReturn {
  const qc = useQueryClient();
  const store = useDriverStore();
  const [hasSystemUpdate, setHasSystemUpdate] = useState<boolean>(false);
  const [recentEvents, setRecentEvents] = useState<SeatEvent[]>([]);
  const prevAvailableRef = useRef<number>(store.availableSeats);

  const syncQuery = useQuery<SeatSyncData>({
    queryKey: ['seat-sync'],
    queryFn: fetchSeatSync,
    enabled,
    refetchInterval: 20000,
    retry: 1,
    staleTime: 10000,
  });

  useEffect(() => {
    if (!syncQuery.data) return;
    const data = syncQuery.data;

    setRecentEvents(data.recent_events);

    if (data.has_system_update) {
      const prevSeats = prevAvailableRef.current;
      const newSeats = data.available_seats;

      if (newSeats !== prevSeats) {
        console.log('[SeatSync] System update detected:', prevSeats, '->', newSeats);
        store.updateSeats(data.available_seats, data.total_seats);
        setHasSystemUpdate(true);

        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }

        qc.invalidateQueries({ queryKey: ['dashboard'] });
      }
    }

    prevAvailableRef.current = data.available_seats;
  }, [syncQuery.data, store, qc]);

  const clearSystemFlag = useCallback(() => {
    setHasSystemUpdate(false);
  }, []);

  return {
    isSyncing: syncQuery.isFetching,
    lastSyncTime: syncQuery.data?.last_updated ?? null,
    recentEvents,
    hasSystemUpdate,
    clearSystemFlag,
  };
}
