import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import { BusAlert, ApproachingBus } from '@/types';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { connectSocket } from '@/services/socket';
import { reconcileBusAlerts } from '@/utils/busAlertState';

const ALERTS_STORAGE_KEY = 'trotro_bus_alerts';

async function fetchBusesAtStop(stopId: string, routeName?: string): Promise<ApproachingBus[]> {
  try {
    const params: Record<string, string> = { stop_id: stopId };
    if (routeName) params.route_name = routeName;
    const { data } = await api.get('/buses/active', { params });
    const buses = (data as Record<string, unknown>[])
      .map((b) => ({
        driver_id: b.driver_id as string,
        bus_registration: b.bus_registration as string,
        driver_name: (b.driver_name as string) ?? 'Driver',
        seats_available: (b.seats_available as number) ?? 0,
        eta_minutes: (b.eta_minutes as number) ?? 5,
        route_name: (b.route_name as string) ?? '',
        lat: b.current_lat ? parseFloat(b.current_lat as string) : 0,
        lng: b.current_lng ? parseFloat(b.current_lng as string) : 0,
      }))
      .filter((b) => !!b.driver_id && b.seats_available > 0);
    const byDriver = new Map(buses.map((b) => [b.driver_id, b]));
    return Array.from(byDriver.values());
  } catch {
    return [];
  }
}

export const [BusAlertProvider, useBusAlerts] = createContextHook(() => {
  const [alerts, setAlerts] = useState<BusAlert[]>([]);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const alertsQuery = useQuery({
    queryKey: ['bus-alerts'],
    enabled: !!user,
    queryFn: async (): Promise<BusAlert[]> => {
      try {
        const { data } = await api.get('/alerts');
        const remote = data as BusAlert[];
        const stored = await AsyncStorage.getItem(ALERTS_STORAGE_KEY);
        const local = stored ? JSON.parse(stored) as BusAlert[] : [];
        const reconciled = reconcileBusAlerts(remote, local);
        await AsyncStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(reconciled));
        return reconciled;
      } catch {
        const stored = await AsyncStorage.getItem(ALERTS_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
      }
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
      const { data } = await api.post('/alerts', {
        routeId: alert.route_id === 'any' ? null : alert.route_id,
        routeName: alert.route_name,
        stopId: alert.stop_id,
        stopName: alert.stop_name,
        alertTime: alert.alert_time,
        schedule: alert.schedule,
        isActive: true,
      });
      const newAlert = data as BusAlert;
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
      await api.patch(`/alerts/${alertId}`, { isActive: false });
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
      await api.delete(`/alerts/${alertId}`);
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

      const buses = await fetchBusesAtStop(
        alert.stop_id,
        alert.route_id && alert.route_id !== 'any' ? alert.route_name : undefined,
      );
      const refreshed = await alertsQuery.refetch();
      return { alert: refreshed.data?.find((item) => item.id === alertId) ?? alert, buses };
    },
    [alerts, alertsQuery.refetch],
  );

  useEffect(() => {
    if (!user) return;
    const refresh = () => { void alertsQuery.refetch(); };
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    let socketCleanup = () => {};
    void connectSocket().then((socket) => {
      socket.on('bus-alert:triggered', refresh);
      socketCleanup = () => socket.off('bus-alert:triggered', refresh);
    }).catch(() => {});
    return () => { appState.remove(); socketCleanup(); };
  }, [user, alertsQuery.refetch]);

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
    refreshAlerts: alertsQuery.refetch,
    isLoading: alertsQuery.isLoading,
    addPending: addAlertMutation.isPending,
  };
});
