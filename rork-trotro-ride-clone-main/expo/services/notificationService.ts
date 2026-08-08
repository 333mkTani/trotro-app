import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { api } from './api';
import { getBusAlertsEnabled } from './busAlertPreferences';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data as Record<string, unknown>;
    const enabled = data?.type !== 'bus_alert' || await getBusAlertsEnabled();
    return {
      shouldShowAlert: enabled,
      shouldPlaySound: enabled,
      shouldSetBadge: enabled,
      shouldShowBanner: enabled,
      shouldShowList: enabled,
    };
  },
});

export async function initPassengerNotifications(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) return null;

  try {
    if (Platform.OS === 'android') {
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
        sound: 'default',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let final = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      final = status;
    }
    if (final !== 'granted') return null;

    // getDevicePushTokenAsync returns raw FCM token on Android — sent directly to Firebase
    const tokenData = await Notifications.getDevicePushTokenAsync();
    console.log('[PassengerNotif] FCM token type:', tokenData.type);
    return tokenData.data;
  } catch (e) {
    console.log('[PassengerNotif] Init error:', e);
    return null;
  }
}

export async function registerPushToken(token: string): Promise<void> {
  try {
    await api.post('/profiles/push-token', { token });
    console.log('[PassengerNotif] Token registered with backend');
  } catch (e) {
    console.log('[PassengerNotif] Token registration failed:', e);
  }
}

export function addNotificationListeners(
  onReceive: (data: Record<string, unknown>) => void,
  onTap: (data: Record<string, unknown>) => void,
) {
  if (Platform.OS === 'web') return () => {};

  // A response may already exist when a notification cold-started the app.
  void Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      onTap(response.notification.request.content.data as Record<string, unknown>);
      void Notifications.clearLastNotificationResponseAsync();
    }
  });
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
