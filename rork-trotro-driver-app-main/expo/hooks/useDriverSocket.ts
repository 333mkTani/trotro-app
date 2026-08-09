import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { connectSocket, disconnectSocket, subscribeToRoute, unsubscribeFromRoute, BookingSocketEvent } from '@/services/socket';
import { getDashboard } from '@/services/driverApi';

const scheduleEvents = [
  'schedule:offer',
  'schedule:reminder',
  'schedule:reopened',
  'schedule:cancelled',
  'schedule:expired',
  'schedule:boarding-open',
  'schedule:boarding-closed',
] as const;

/**
 * Connects the driver to their `driver:<driverId>` socket room (joined
 * automatically server-side on handshake — see backend/src/realtime/io.js)
 * and refreshes the relevant screens the instant a booking is created or
 * changes status, instead of waiting on the existing REST poll intervals.
 *
 * Also subscribes to the driver's current route room so unclaimed,
 * same-route requests (no driver assigned yet) arrive live too — falls
 * back to the existing 45s ['overflow'] poll if the route changes mid
 * session, since this only resolves the route once per connection.
 */
export function useDriverSocket(isAuthenticated: boolean) {
  const qc = useQueryClient();
  const isConnectingRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web' || isConnectingRef.current) return;

    isConnectingRef.current = true;
    let cancelled = false;
    let subscribedRouteId: string | null = null;
    let activeSocket: Awaited<ReturnType<typeof connectSocket>> | null = null;

    const invalidateBookingQueries = () => {
      void qc.invalidateQueries({ queryKey: ['overflow'] });
      void qc.invalidateQueries({ queryKey: ['bookings'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    };

    const refreshSchedules = () => {
      void qc.invalidateQueries({ queryKey: ['future-requests'] });
      void qc.invalidateQueries({ queryKey: ['future-request-history'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    };

    const setup = async () => {
      try {
        const socket = await connectSocket();
        if (cancelled) {
          disconnectSocket();
          return;
        }
        activeSocket = socket;

        socket.on('booking:new', (booking: BookingSocketEvent) => {
          console.log('[useDriverSocket] booking:new', booking.id);
          invalidateBookingQueries();
        });

        socket.on('booking:updated', (booking: BookingSocketEvent) => {
          console.log('[useDriverSocket] booking:updated', booking.id, booking.status);
          invalidateBookingQueries();
        });

        scheduleEvents.forEach((event) => {
          socket.on(event, refreshSchedules);
        });

        console.log('[useDriverSocket] Connected');

        try {
          const dashboard = await getDashboard();
          const routeId = dashboard.assigned_route?.id;
          if (routeId && !cancelled) {
            subscribeToRoute(routeId);
            subscribedRouteId = routeId;
            console.log('[useDriverSocket] Subscribed to route', routeId);
          }
        } catch (e) {
          console.log('[useDriverSocket] Route subscribe failed:', e);
        }
      } catch (e) {
        console.log('[useDriverSocket] Connection failed:', e);
      } finally {
        isConnectingRef.current = false;
      }
    };

    setup();

    return () => {
      cancelled = true;
      isConnectingRef.current = false;
      scheduleEvents.forEach((event) => {
        activeSocket?.off(event, refreshSchedules);
      });
      if (subscribedRouteId) unsubscribeFromRoute(subscribedRouteId);
      disconnectSocket();
    };
  }, [isAuthenticated, qc]);
}
