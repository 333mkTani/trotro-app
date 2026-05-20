import { useEffect, useRef, useCallback } from 'react';
import { Platform, AppState } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  initializeNotifications,
  checkForNewRequests,
  sendLocalRequestNotification,
  sendBatchRequestNotification,
  setBadgeCount,
  clearAllNotifications,
} from '@/services/notificationService';
import { OverflowRequest } from '@/types';

export function useNotifications(isAuthenticated: boolean) {
  const pushTokenRef = useRef<string | null>(null);
  const notificationListenerRef = useRef<{ remove: () => void } | null>(null);
  const responseListenerRef = useRef<{ remove: () => void } | null>(null);
  const qc = useQueryClient();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web' || isInitializedRef.current) return;

    let mounted = true;

    const setup = async () => {
      try {
        const Notifications = await import('expo-notifications');

        const token = await initializeNotifications();
        if (mounted) {
          pushTokenRef.current = token;
          isInitializedRef.current = true;
          console.log('[useNotifications] Initialized, token:', token ? 'obtained' : 'none');
        }

        notificationListenerRef.current = Notifications.addNotificationReceivedListener(
          (notification) => {
            console.log('[useNotifications] Notification received:', notification.request.content.title);
          }
        );

        responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(
          (response) => {
            const data = response.notification.request.content.data;
            console.log('[useNotifications] Notification tapped, data:', data);

            if (data?.type === 'new_request' || data?.type === 'batch_request') {
              router.push('/(tabs)/requests');
            }

            qc.invalidateQueries({ queryKey: ['overflow'] });
          }
        );
      } catch (e) {
        console.log('[useNotifications] Setup error:', e);
      }
    };

    setup();

    return () => {
      mounted = false;
      notificationListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [isAuthenticated, qc]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clearAllNotifications();
      }
    });

    return () => subscription.remove();
  }, []);

  const notifyNewRequests = useCallback(async (requests: OverflowRequest[]) => {
    if (Platform.OS === 'web' || !isInitializedRef.current) return;

    try {
      const newRequests = await checkForNewRequests(requests);
      if (newRequests.length === 0) return;

      const openCount = requests.filter((r) => r.status === 'OPEN').length;
      await setBadgeCount(openCount);

      if (newRequests.length === 1) {
        await sendLocalRequestNotification(newRequests[0]);
      } else if (newRequests.length <= 3) {
        for (const req of newRequests) {
          await sendLocalRequestNotification(req);
        }
      } else {
        await sendBatchRequestNotification(newRequests.length);
      }
    } catch (e) {
      console.log('[useNotifications] notifyNewRequests error:', e);
    }
  }, []);

  return { pushToken: pushTokenRef.current, notifyNewRequests };
}
