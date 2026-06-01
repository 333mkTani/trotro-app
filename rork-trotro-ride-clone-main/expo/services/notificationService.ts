import { Platform } from 'react-native';
import { api } from './api';

let messagingModule: typeof import('@react-native-firebase/messaging').default | null = null;

async function getMessaging() {
  if (Platform.OS === 'web') return null;
  if (messagingModule) return messagingModule;
  try {
    const mod = await import('@react-native-firebase/messaging');
    messagingModule = mod.default;
    return messagingModule;
  } catch {
    return null;
  }
}

export async function initPassengerNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const messaging = await getMessaging();
  if (!messaging) return null;

  try {
    // Request permission (iOS prompts; Android auto-grants on API < 33)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('[PassengerNotif] Permission denied');
      return null;
    }

    const token = await messaging().getToken();
    console.log('[PassengerNotif] FCM token:', token?.slice(0, 20) + '…');

    // Handle notifications received while app is in foreground
    messaging().onMessage(async (remoteMessage) => {
      console.log('[PassengerNotif] Foreground message:', remoteMessage.notification?.title);
    });

    // Handle background message tap
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('[PassengerNotif] Notification opened app:', remoteMessage.data?.type);
    });

    return token;
  } catch (e) {
    console.log('[PassengerNotif] Init error:', e);
    return null;
  }
}

export async function registerPushToken(token: string): Promise<void> {
  try {
    await api.post('/profile/push-token', { token });
    console.log('[PassengerNotif] FCM token registered with backend');
  } catch (e) {
    console.log('[PassengerNotif] Token registration failed:', e);
  }
}

export function addNotificationListeners(
  onReceive: (data: Record<string, unknown>) => void,
  onTap: (data: Record<string, unknown>) => void,
) {
  if (Platform.OS === 'web') return () => {};

  let unsubscribeMessage: (() => void) | undefined;
  let unsubscribeOpen: (() => void) | undefined;

  getMessaging().then((messaging) => {
    if (!messaging) return;

    unsubscribeMessage = messaging().onMessage((msg) => {
      if (msg.data) onReceive(msg.data as Record<string, unknown>);
    });

    unsubscribeOpen = messaging().onNotificationOpenedApp((msg) => {
      if (msg.data) onTap(msg.data as Record<string, unknown>);
    });
  });

  return () => {
    unsubscribeMessage?.();
    unsubscribeOpen?.();
  };
}
