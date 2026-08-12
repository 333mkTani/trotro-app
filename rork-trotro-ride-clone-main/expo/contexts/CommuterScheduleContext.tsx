import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { connectSocket } from '@/services/socket';
import type {
  CommuterSchedule,
  CommuterScheduleStatus,
  CreateCommuterScheduleInput,
  ScheduleOccurrence,
  UpdateCommuterScheduleInput,
  PublishedDepartureSlot,
} from '@/types';

export const [CommuterScheduleProvider, useCommuterSchedules] = createContextHook(() => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [occurrenceRefreshToken, setOccurrenceRefreshToken] = useState(0);
  const queryKey = ['commuter-schedules'] as const;

  const schedulesQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<CommuterSchedule[]> => {
      const { data } = await api.get('/commuter-schedules');
      return data as CommuterSchedule[];
    },
    enabled: Boolean(user),
  });

  const createMutation = useMutation({
    mutationFn: async (input: CreateCommuterScheduleInput) => {
      const { data } = await api.post('/commuter-schedules', input);
      return data as CommuterSchedule;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: UpdateCommuterScheduleInput }) => {
      const { data } = await api.patch(`/commuter-schedules/${id}`, patch);
      return data as CommuterSchedule;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/commuter-schedules/${id}`),
    onSuccess: async () => {
      setOccurrenceRefreshToken((token) => token + 1);
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  const getOccurrences = useCallback(async (id: string): Promise<ScheduleOccurrence[]> => {
    const { data } = await api.get(`/commuter-schedules/${id}/occurrences`);
    return data as ScheduleOccurrence[];
  }, []);

  const getAllOccurrences = useCallback(async (): Promise<ScheduleOccurrence[]> => {
    const { data } = await api.get('/commuter-schedules/occurrences');
    return data as ScheduleOccurrence[];
  }, []);

  const getPublishedSlots = useCallback(async (params: {
    routeId: string; departureStopId: string; destinationStopId: string;
  }): Promise<PublishedDepartureSlot[]> => {
    const { data } = await api.get('/departure-slots/published', { params });
    return data as PublishedDepartureSlot[];
  }, []);

  const refreshScheduleData = useCallback(async () => {
    setOccurrenceRefreshToken((token) => token + 1);
    return schedulesQuery.refetch();
  }, [schedulesQuery.refetch]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    let cleanup = () => {};
    const refresh = () => { void refreshScheduleData(); };
    const events = [
      'schedule:accepted', 'schedule:driver-withdrawn', 'schedule:unmatched',
      'schedule:backup-started', 'schedule:backup-stopped', 'schedule:boarding-open',
      'schedule:boarding-closed', 'schedule:cancelled', 'schedule:expired',
      'schedule:updated',
    ];
    void connectSocket().then((socket) => {
      if (!active) return;
      events.forEach((event) => socket.on(event, refresh));
      cleanup = () => events.forEach((event) => socket.off(event, refresh));
    }).catch(() => {});
    return () => { active = false; cleanup(); };
  }, [user, refreshScheduleData]);
  const cancelOccurrenceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/commuter-schedules/occurrences/${id}/cancel`);
      return data as ScheduleOccurrence;
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey }),
  });


  return {
    schedules: schedulesQuery.data ?? [],
    schedulesLoading: schedulesQuery.isLoading,
    createSchedule: createMutation.mutateAsync,
    createSchedulePending: createMutation.isPending,
    updateSchedule: statusMutation.mutateAsync,
    setScheduleStatus: ({ id, status }: { id: string; status: CommuterScheduleStatus }) =>
      statusMutation.mutateAsync({ id, patch: { status } }),
    scheduleStatusPending: statusMutation.isPending,
    deleteSchedule: deleteMutation.mutateAsync,
    deleteSchedulePending: deleteMutation.isPending,
    getOccurrences,
    getAllOccurrences,
    getPublishedSlots,
    cancelOccurrence: cancelOccurrenceMutation.mutateAsync,
    cancelOccurrencePending: cancelOccurrenceMutation.isPending,
    refreshSchedules: schedulesQuery.refetch,
    refreshScheduleData,
    occurrenceRefreshToken,
    schedulesError: schedulesQuery.error,
  };
});
