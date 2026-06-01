import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OverflowRequest, AutoAcceptedBooking } from '@/types';

const NOTIFICATION_PREFS_KEY = 'notification_preferences';
const SEEN_REQUESTS_KEY = 'seen_request_ids';

interface NotificationPreferences {
  enabled: boolean;
  newRequests: boolean;
  requestUpdates: boolean;
  sound: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  enabled: true,
  newRequests: true,
  requestUpdates: true,
  sound: true,
};

let Notifications: typeof import('expo-notifications') | null = null;
let Device: typeof import('expo-device') | null = null;

async function loadModules() {
  if (Platform.OS === 'web') return;
  try {
    Notifications = await import('expo-notifications');
    Device = await import('expo-device');
  } catch (e) {
    console.log('[NotificationService] Failed to load native modules:', e);
  }
}

export async function initializeNotifications(): Promise<string | null> {
  await loadModules();
  if (Platform.OS === 'web' || !Notifications || !Device) {
    console.log('[NotificationService] Notifications not supported on web');
    return null;
  }

  try {
    await Notifications.setNotificationChannelAsync('requests', {
      name: 'Ride Requests',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1565C0',
      sound: 'default',
    });

    await Notifications.setNotificationChannelAsync('updates', {
      name: 'Request Updates',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });

    console.log('[NotificationService] Notification channels configured');
  } catch (e) {
    console.log('[NotificationService] Channel setup error:', e);
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[NotificationService] Permission not granted');
      return null;
    }

    let token: string | null = null;
    if (Device.isDevice) {
      try {
        // getDevicePushTokenAsync returns raw FCM token on Android
        const tokenData = await Notifications.getDevicePushTokenAsync();
        token = tokenData.data;
        console.log('[NotificationService] FCM token obtained, type:', tokenData.type);
      } catch (e) {
        console.log('[NotificationService] Could not get push token:', e);
      }
    } else {
      console.log('[NotificationService] Running on simulator, skipping push token');
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    return token;
  } catch (e) {
    console.log('[NotificationService] Init error:', e);
    return null;
  }
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {
    console.log('[NotificationService] Failed to load prefs:', e);
  }
  return DEFAULT_PREFS;
}

export async function setNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences();
  const updated = { ...current, ...prefs };
  try {
    await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated));
    console.log('[NotificationService] Prefs updated:', updated);
  } catch (e) {
    console.log('[NotificationService] Failed to save prefs:', e);
  }
  return updated;
}

async function getSeenRequestIds(): Promise<Set<string>> {
  try {
    const stored = await AsyncStorage.getItem(SEEN_REQUESTS_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch (e) {
    console.log('[NotificationService] Failed to load seen IDs:', e);
  }
  return new Set();
}

async function saveSeenRequestIds(ids: Set<string>): Promise<void> {
  try {
    const arr = Array.from(ids).slice(-100);
    await AsyncStorage.setItem(SEEN_REQUESTS_KEY, JSON.stringify(arr));
  } catch (e) {
    console.log('[NotificationService] Failed to save seen IDs:', e);
  }
}

export async function checkForNewRequests(requests: OverflowRequest[]): Promise<OverflowRequest[]> {
  const openRequests = requests.filter((r) => r.status === 'OPEN');
  const seenIds = await getSeenRequestIds();

  const newRequests = openRequests.filter((r) => !seenIds.has(r.id));

  if (newRequests.length > 0) {
    newRequests.forEach((r) => seenIds.add(r.id));
    await saveSeenRequestIds(seenIds);
    console.log('[NotificationService] New requests detected:', newRequests.length);
  }

  return newRequests;
}

export async function sendLocalRequestNotification(request: OverflowRequest): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) {
    console.log('[NotificationService] Local notification skipped (web/no module)');
    return;
  }

  const prefs = await getNotificationPreferences();
  if (!prefs.enabled || !prefs.newRequests) {
    console.log('[NotificationService] Notifications disabled by user');
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Ride Request',
        body: `${request.passenger_name ?? 'A passenger'} needs a ride from ${request.pickup_stop}`,
        data: { requestId: request.id, type: 'new_request' },
        sound: prefs.sound ? 'default' : undefined,
        categoryIdentifier: 'request',
      },
      trigger: null,
    });
    console.log('[NotificationService] Local notification sent for request:', request.id);
  } catch (e) {
    console.log('[NotificationService] Failed to send notification:', e);
  }
}

export async function sendBatchRequestNotification(count: number): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;

  const prefs = await getNotificationPreferences();
  if (!prefs.enabled || !prefs.newRequests) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'New Ride Requests',
        body: `${count} new passenger${count > 1 ? 's' : ''} nearby need${count === 1 ? 's' : ''} a ride`,
        data: { type: 'batch_request', count },
        sound: prefs.sound ? 'default' : undefined,
      },
      trigger: null,
    });
    console.log('[NotificationService] Batch notification sent, count:', count);
  } catch (e) {
    console.log('[NotificationService] Failed to send batch notification:', e);
  }
}

export async function sendRequestStatusNotification(
  requestId: string,
  status: 'ACCEPTED' | 'DECLINED' | 'EXPIRED',
  stopName: string,
): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;

  const prefs = await getNotificationPreferences();
  if (!prefs.enabled || !prefs.requestUpdates) return;

  const messages: Record<string, { title: string; body: string }> = {
    ACCEPTED: { title: 'Request Accepted', body: `You accepted a ride request at ${stopName}. Navigate to pickup.` },
    DECLINED: { title: 'Request Declined', body: `Ride request at ${stopName} was declined.` },
    EXPIRED: { title: 'Request Expired', body: `The ride request at ${stopName} has expired.` },
  };

  const msg = messages[status];
  if (!msg) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: msg.title,
        body: msg.body,
        data: { requestId, type: 'status_update', status },
        sound: prefs.sound ? 'default' : undefined,
      },
      trigger: null,
    });
  } catch (e) {
    console.log('[NotificationService] Failed to send status notification:', e);
  }
}

export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (e) {
    console.log('[NotificationService] Failed to set badge:', e);
  }
}

export async function sendAutoAcceptNotification(booking: AutoAcceptedBooking): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) {
    console.log('[NotificationService] Auto-accept notification skipped (web/no module)');
    return;
  }

  const prefs = await getNotificationPreferences();
  if (!prefs.enabled || !prefs.requestUpdates) return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Booking Auto-Accepted',
        body: `${booking.passenger_name} boarding at ${booking.pickup_stop} → ${booking.destination_stop}`,
        data: { bookingId: booking.id, type: 'auto_accept' },
        sound: prefs.sound ? 'default' : undefined,
      },
      trigger: null,
    });
    console.log('[NotificationService] Auto-accept notification sent for:', booking.passenger_name);
  } catch (e) {
    console.log('[NotificationService] Failed to send auto-accept notification:', e);
  }
}

export async function clearAllNotifications(): Promise<void> {
  if (Platform.OS === 'web' || !Notifications) return;
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch (e) {
    console.log('[NotificationService] Failed to clear notifications:', e);
  }
}
