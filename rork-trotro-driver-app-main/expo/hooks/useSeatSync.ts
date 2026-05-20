import { useEffect, useRef, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fetchSeatSync, reportPassengerEvent } from '@/services/driverApi';
import { useDriverStore } from '@/store/driverStore';
import { SeatEvent, SeatSyncData } from '@/types';

interface UseSeatSyncReturn {
  isSyncing: boolean;
  lastSyncTime: string | null;
  recentEvents: SeatEvent[];
  hasSystemUpdate: boolean;
  reportBoarding: (passengerName?: string) => Promise<void>;
  reportAlighting: (passengerName?: string) => Promise<void>;
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

  const reportBoarding = useCallback(async (passengerName?: string) => {
    try {
      const evt = await reportPassengerEvent('BOARDING', passengerName);
      console.log('[SeatSync] Boarding reported:', evt.id);
      const newAvailable = Math.max(0, store.availableSeats - 1);
      store.updateSeats(newAvailable, store.totalSeats);
      prevAvailableRef.current = newAvailable;
      qc.invalidateQueries({ queryKey: ['seat-sync'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) {
      console.log('[SeatSync] Report boarding error:', e);
    }
  }, [store, qc]);

  const reportAlighting = useCallback(async (passengerName?: string) => {
    try {
      const evt = await reportPassengerEvent('ALIGHTING', passengerName);
      console.log('[SeatSync] Alighting reported:', evt.id);
      const newAvailable = Math.min(store.totalSeats, store.availableSeats + 1);
      store.updateSeats(newAvailable, store.totalSeats);
      prevAvailableRef.current = newAvailable;
      qc.invalidateQueries({ queryKey: ['seat-sync'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e) {
      console.log('[SeatSync] Report alighting error:', e);
    }
  }, [store, qc]);

  const clearSystemFlag = useCallback(() => {
    setHasSystemUpdate(false);
  }, []);

  return {
    isSyncing: syncQuery.isFetching,
    lastSyncTime: syncQuery.data?.last_updated ?? null,
    recentEvents,
    hasSystemUpdate,
    reportBoarding,
    reportAlighting,
    clearSystemFlag,
  };
}
