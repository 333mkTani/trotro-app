import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { BusAlert, ApproachingBus, DayOfWeek } from '@/types';
import { MOCK_APPROACHING_BUSES } from '@/mocks/data';
import { useLocation } from '@/contexts/LocationContext';

const ALERTS_STORAGE_KEY = 'trotro_bus_alerts';

const DAY_MAP: Record<number, DayOfWeek> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

function getBusesForRouteAtStop(routeId: string, stopId: string, routes: { id: string; name: string }[]): ApproachingBus[] {
  const route = routes.find((r) => r.id === routeId);
  if (!route) return [];
  const buses = MOCK_APPROACHING_BUSES[stopId] ?? [];
  return buses.filter(
    (b) => b.seats_available > 0 && b.route_name === route.name,
  );
}

function getAllBusesAtStop(stopId: string): ApproachingBus[] {
  const buses = MOCK_APPROACHING_BUSES[stopId] ?? [];
  return buses.filter((b) => b.seats_available > 0);
}

function getScheduledTimeForDay(alert: BusAlert, day: DayOfWeek): { hour: number; minute: number } | null {
  if (!alert.schedule) return null;
  if (!alert.schedule.days.includes(day)) return null;

  if (alert.schedule.time_mode === 'same') {
    return {
      hour: alert.schedule.same_hour ?? 0,
      minute: alert.schedule.same_minute ?? 0,
    };
  }

  const entry = alert.schedule.custom_times?.find((t) => t.day === day);
  if (!entry) return null;
  return { hour: entry.hour, minute: entry.minute };
}

export const [BusAlertProvider, useBusAlerts] = createContextHook(() => {
  const [alerts, setAlerts] = useState<BusAlert[]>([]);
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { regionRoutes } = useLocation();

  const alertsQuery = useQuery({
    queryKey: ['bus-alerts'],
    queryFn: async (): Promise<BusAlert[]> => {
      const stored = await AsyncStorage.getItem(ALERTS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    },
  });

  useEffect(() => {
    if (alertsQuery.data) {
      setAlerts(alertsQuery.data);
    }
  }, [alertsQuery.data]);

  const persist = useCallback(async (updated: BusAlert[]) => {
    await AsyncStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addAlertMutation = useMutation({
    mutationFn: async (alert: Omit<BusAlert, 'id' | 'is_active' | 'triggered' | 'created_at'>) => {
      const newAlert: BusAlert = {
        ...alert,
        id: 'alert-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        is_active: true,
        triggered: false,
        created_at: new Date().toISOString(),
      };
      const updated = [...alerts, newAlert];
      setAlerts(updated);
      await persist(updated);
      return newAlert;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bus-alerts'] });
    },
  });

  const cancelAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const updated = alerts.map((a) =>
        a.id === alertId ? { ...a, is_active: false } : a,
      );
      setAlerts(updated);
      await persist(updated);
      return alertId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bus-alerts'] });
    },
  });

  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const updated = alerts.filter((a) => a.id !== alertId);
      setAlerts(updated);
      await persist(updated);
      return alertId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bus-alerts'] });
    },
  });

  const triggerAlert = useCallback(
    async (alertId: string) => {
      const alert = alerts.find((a) => a.id === alertId);
      if (!alert || !alert.is_active) return null;

      let buses: ApproachingBus[];
      if (alert.route_id === 'any') {
        buses = getAllBusesAtStop(alert.stop_id);
      } else {
        buses = getBusesForRouteAtStop(alert.route_id, alert.stop_id, regionRoutes);
      }

      const isScheduled = !!alert.schedule && alert.schedule.days.length > 0;
      const todayKey = new Date().toISOString().split('T')[0];

      let updated: BusAlert[];
      if (isScheduled) {
        updated = alerts.map((a) =>
          a.id === alertId
            ? { ...a, triggered: true, last_triggered_day: todayKey, triggered_buses: buses }
            : a,
        );
      } else {
        updated = alerts.map((a) =>
          a.id === alertId
            ? { ...a, triggered: true, is_active: false, triggered_buses: buses }
            : a,
        );
      }

      setAlerts(updated);
      await persist(updated);
      queryClient.invalidateQueries({ queryKey: ['bus-alerts'] });

      return { alert: updated.find((a) => a.id === alertId)!, buses };
    },
    [alerts, persist, queryClient, regionRoutes],
  );

  const resetScheduledAlert = useCallback(
    async (alertId: string) => {
      const updated = alerts.map((a) =>
        a.id === alertId ? { ...a, triggered: false, triggered_buses: undefined } : a,
      );
      setAlerts(updated);
      await persist(updated);
      queryClient.invalidateQueries({ queryKey: ['bus-alerts'] });
    },
    [alerts, persist, queryClient],
  );

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      const now = new Date();
      const todayDay = DAY_MAP[now.getDay()];
      const todayKey = now.toISOString().split('T')[0];
      const nowHour = now.getHours();
      const nowMinute = now.getMinutes();

      const activeAlerts = alerts.filter((a) => a.is_active);

      for (const alert of activeAlerts) {
        const isScheduled = !!alert.schedule && alert.schedule.days.length > 0;

        if (isScheduled) {
          if (alert.last_triggered_day === todayKey) continue;

          const timeForToday = getScheduledTimeForDay(alert, todayDay);
          if (!timeForToday) continue;

          const scheduledMinutes = timeForToday.hour * 60 + timeForToday.minute;
          const currentMinutes = nowHour * 60 + nowMinute;
          const diff = currentMinutes - scheduledMinutes;

          if (diff >= 0 && diff < 2) {
            console.log('[BusAlert] Triggering scheduled alert:', alert.id, alert.stop_name, todayDay);
            triggerAlert(alert.id);
          }
        } else {
          if (alert.triggered) continue;
          const alertTime = new Date(alert.alert_time);
          const diffMs = alertTime.getTime() - now.getTime();
          if (diffMs <= 0 && diffMs > -60000) {
            console.log('[BusAlert] Triggering one-time alert:', alert.id, alert.stop_name);
            triggerAlert(alert.id);
          }
        }
      }

      const scheduledAlerts = alerts.filter(
        (a) => a.is_active && a.triggered && a.schedule && a.schedule.days.length > 0 && a.last_triggered_day !== todayKey,
      );
      for (const alert of scheduledAlerts) {
        resetScheduledAlert(alert.id);
      }
    }, 10000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [alerts, triggerAlert, resetScheduledAlert]);

  const activeAlerts = alerts.filter((a) => a.is_active && !a.triggered);
  const triggeredAlerts = alerts.filter((a) => a.triggered);
  const pastAlerts = alerts.filter((a) => !a.is_active);

  return {
    alerts,
    activeAlerts,
    triggeredAlerts,
    pastAlerts,
    addAlert: addAlertMutation.mutateAsync,
    cancelAlert: cancelAlertMutation.mutateAsync,
    deleteAlert: deleteAlertMutation.mutateAsync,
    triggerAlert,
    isLoading: alertsQuery.isLoading,
    addPending: addAlertMutation.isPending,
  };
});
