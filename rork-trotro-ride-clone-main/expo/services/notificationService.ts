import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { api } from './api';
import { BusAlert, DayOfWeek } from '@/types';

const DAY_TO_WEEKDAY: Record<DayOfWeek, number> = {
  Sun: 1, Mon: 2, Tue: 3, Wed: 4, Thu: 5, Fri: 6, Sat: 7,
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
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

export async function scheduleBusAlertNotifications(alert: BusAlert): Promise<string[]> {
  if (Platform.OS === 'web' || !alert.is_active) return [];
  try {
    const content: Notifications.NotificationContentInput = {
      title: 'Bus alert',
      body: `Check buses approaching ${alert.stop_name}.`,
      sound: 'default',
      data: { type: 'bus_alert', alertId: alert.id },
    };

    if (alert.schedule?.days?.length) {
      return Promise.all(alert.schedule.days.map((day) => {
        const custom = alert.schedule?.custom_times?.find((entry) => entry.day === day);
        const hour = alert.schedule?.time_mode === 'custom' ? custom?.hour : alert.schedule?.same_hour;
        const minute = alert.schedule?.time_mode === 'custom' ? custom?.minute : alert.schedule?.same_minute;
        if (hour == null || minute == null) return Promise.resolve('');
        return Notifications.scheduleNotificationAsync({
          content,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: DAY_TO_WEEKDAY[day], hour, minute,
            channelId: 'default',
          },
        });
      })).then((ids) => ids.filter(Boolean));
    }

    const date = new Date(alert.alert_time);
    if (Number.isNaN(date.getTime())) return [];
    // An overdue alert is delivered immediately instead of being silently lost.
    const triggerDate = date.getTime() > Date.now() ? date : new Date(Date.now() + 1000);
    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: 'default',
      },
    });
    return [id];
  } catch (error) {
    console.log('[PassengerNotif] Could not schedule bus alert:', error);
    return [];
  }
}

export async function cancelBusAlertNotifications(ids: string[]): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.allSettled(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
}

export function addNotificationListeners(
  onReceive: (data: Record<string, unknown>) => void,
  onTap: (data: Record<string, unknown>) => void,
) {
  if (Platform.OS === 'web') return () => {};

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
