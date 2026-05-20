import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Booking, BookingStatus, ApproachingBus, RidePaymentMethod, RideSchedule, BufferMinutes } from '@/types';
import { api } from '@/services/api';

const mapBooking = (b: Record<string, unknown>): Booking => ({
  id: b.id as string,
  passenger_id: b.passenger_id as string,
  driver_id: b.driver_id as string | undefined,
  driver_name: b.driver_name as string | undefined,
  bus_registration: b.bus_registration as string | undefined,
  pickup_stop_id: b.pickup_stop_id as string,
  pickup_stop_name: b.pickup_stop_name as string,
  destination_stop_id: b.destination_stop_id as string,
  destination_stop_name: b.destination_stop_name as string,
  desired_arrival_time: b.desired_arrival_time as string,
  buffer_minutes: b.buffer_minutes as BufferMinutes,
  status: b.status as BookingStatus,
  confirmed_at: b.confirmed_at as string | undefined,
  completed_at: b.completed_at as string | undefined,
  created_at: b.created_at as string,
  route_name: b.route_name as string | undefined,
  ride_fare: b.ride_fare as number | undefined,
  ride_payment_method: b.ride_payment_method as RidePaymentMethod | undefined,
  ride_schedule: b.ride_schedule as RideSchedule | undefined,
  verification_code: b.verification_code as string | undefined,
  code_valid_until: b.code_valid_until as string | undefined,
});

export const [BookingProvider, useBookings] = createContextHook(() => {
  const queryClient = useQueryClient();

  const bookingsQuery = useQuery({
    queryKey: ['bookings'],
    queryFn: async (): Promise<Booking[]> => {
      const { data } = await api.get('/bookings');
      const bookings: Booking[] = (data as Record<string, unknown>[]).map(mapBooking);

      // Fetch verification codes for confirmed bookings that don't have one yet
      const needsCode = bookings.filter((b) => b.status === 'confirmed' && !b.verification_code);
      await Promise.allSettled(
        needsCode.map(async (b) => {
          try {
            const { data: code } = await api.get(`/bookings/${b.id}/code`);
            b.verification_code = code.code;
            b.code_valid_until = code.valid_until;
          } catch {
            // code not yet generated — driver hasn't confirmed yet
          }
        })
      );

      return bookings;
    },
    refetchInterval: 15000,
  });

  const bookings = bookingsQuery.data ?? [];

  const bookBusMutation = useMutation({
    mutationFn: async ({
      bus,
      pickupStopId,
      pickupStopName,
      destinationStopId,
      destinationStopName,
    }: {
      bus: ApproachingBus;
      pickupStopId: string;
      pickupStopName: string;
      destinationStopId: string;
      destinationStopName: string;
      passengerId: string;
    }): Promise<Booking> => {
      const arrivalTime = new Date(Date.now() + bus.eta_minutes * 60 * 1000).toISOString();
      const { data } = await api.post('/bookings', {
        pickupStopId,
        pickupStopName,
        destinationStopId,
        destinationStopName,
        desiredArrivalTime: arrivalTime,
        bufferMinutes: 10,
        driverId: bus.driver_id,
        routeName: bus.route_name,
      });
      return mapBooking(data as Record<string, unknown>);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  });

  const scheduleRideMutation = useMutation({
    mutationFn: async ({
      pickupStopId,
      pickupStopName,
      destinationStopId,
      destinationStopName,
      routeName,
      rideFare,
      desiredArrivalTime,
      bufferMinutes,
      rideSchedule,
    }: {
      pickupStopId: string;
      pickupStopName: string;
      destinationStopId: string;
      destinationStopName: string;
      routeName: string;
      rideFare: number;
      desiredArrivalTime: string;
      bufferMinutes: BufferMinutes;
      passengerId: string;
      rideSchedule: RideSchedule;
    }): Promise<Booking> => {
      const { data } = await api.post('/bookings', {
        pickupStopId,
        pickupStopName,
        destinationStopId,
        destinationStopName,
        desiredArrivalTime,
        bufferMinutes,
        routeName,
        rideFare,
        rideSchedule,
      });
      return mapBooking(data as Record<string, unknown>);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (bookingId: string): Promise<string> => {
      await api.post(`/bookings/${bookingId}/cancel`);
      return bookingId;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bookings'] }),
  });

  const completeRideMutation = useMutation({
    mutationFn: async ({
      bookingId,
      paymentMethod,
      fare,
    }: {
      bookingId: string;
      paymentMethod: RidePaymentMethod;
      fare: number;
    }): Promise<string> => {
      await api.post(`/bookings/${bookingId}/complete`);
      if (paymentMethod === 'wallet') {
        await api.post('/wallet/charge', { amount: fare, bookingId });
      }
      return bookingId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });

  return {
    bookings,
    bookBus: bookBusMutation.mutateAsync,
    bookBusPending: bookBusMutation.isPending,
    scheduleRide: scheduleRideMutation.mutateAsync,
    scheduleRidePending: scheduleRideMutation.isPending,
    cancelBooking: cancelBookingMutation.mutateAsync,
    cancelPending: cancelBookingMutation.isPending,
    completeRide: completeRideMutation.mutateAsync,
    completePending: completeRideMutation.isPending,
    isLoading: bookingsQuery.isLoading,
  };
});
