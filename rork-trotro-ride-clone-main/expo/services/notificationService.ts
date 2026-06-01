import { Platform } from 'react-native';
import { api } from './api';

let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;

async function loadModules() {
  if (Platform.OS === 'web') return;
  try {
    Notifications = await import('expo-notifications');
    Device = await import('expo-device');
  } catch (e) {
    console.log('[PassengerNotif] Failed to load modules:', e);
  }
}

export async function initPassengerNotifications(): Promise<string | null> {
  await loadModules();
  if (Platform.OS === 'web' || !Notifications || !Device) return null;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Trotro Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#E85D04',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('bus_approaching', {
      name: 'Bus Approaching',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#E85D04',
      sound: 'default',
    });
  } catch (e) {
    console.log('[PassengerNotif] Channel setup error:', e);
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') return null;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    if (!Device.isDevice) return null;

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });
    const token = tokenData.data;
    console.log('[PassengerNotif] Push token:', token);
    return token;
  } catch (e) {
    console.log('[PassengerNotif] Init error:', e);
    return null;
  }
}

export async function registerPushToken(token: string): Promise<void> {
  try {
    await api.post('/profile/push-token', { token });
    console.log('[PassengerNotif] Token registered with backend');
  } catch (e) {
    console.log('[PassengerNotif] Token registration failed:', e);
  }
}

export function addNotificationListeners(
  onReceive: (data: Record<string, unknown>) => void,
  onTap: (data: Record<string, unknown>) => void,
) {
  if (Platform.OS === 'web' || !Notifications) return () => {};

  const recvSub = Notifications.addNotificationReceivedListener((n) => {
    onReceive(n.request.content.data as Record<string, unknown>);
  });
  const tapSub = Notifications.addNotificationResponseReceivedListener((r) => {
    onTap(r.notification.request.content.data as Record<string, unknown>);
  });

  return () => {
    recvSub.remove();
    tapSub.remove();
  };
}
