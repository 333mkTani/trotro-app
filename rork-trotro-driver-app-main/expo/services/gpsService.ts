import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { getTokens } from './secureAuthStorage';
import { Platform } from 'react-native';
import { useDriverStore } from '@/store/driverStore';
import { useAuthStore } from '@/store/authStore';
import { postLocation } from './driverApi';
import { initializeLocalSync, queueMutation } from './localSync';
import { haversineDistance } from '@/utils/helpers';

let gpsInterval: ReturnType<typeof setInterval> | null = null;
let lastPostedLat: number | null = null;
let lastPostedLng: number | null = null;
let lastPostedAt = 0;
let gpsStarting = false;
const MIN_DISTANCE_M = 50;
const POST_INTERVAL_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 60000;
export const DRIVER_LOCATION_TASK = 'trotro-driver-background-location';

type BackgroundLocationData = { locations?: Location.LocationObject[] };

async function restoreAuthForBackgroundTask(): Promise<boolean> {
  if (useAuthStore.getState().accessToken) return true;
  const tokens = await getTokens();
  if (!tokens?.accessToken) return false;
  await useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
  return true;
}

async function queueLocation(lat: number, lng: number): Promise<void> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) {
    console.log('[GPS] Cannot queue location without an authenticated driver');
    return;
  }
  await initializeLocalSync();
  const eventKey = `gps:${userId}:${Date.now()}:${lat}:${lng}`;
  await queueMutation({
    userId,
    entity: 'driver_location',
    operation: 'update',
    payload: { lat, lng },
    eventId: eventKey,
    idempotencyKey: eventKey,
  });
}

async function sendLocation(lat: number, lng: number, isOnline: boolean): Promise<void> {
  if (lastPostedLat !== null && lastPostedLng !== null) {
    const distKm = haversineDistance(lastPostedLat, lastPostedLng, lat, lng);
    if (distKm * 1000 < MIN_DISTANCE_M && Date.now() - lastPostedAt < HEARTBEAT_INTERVAL_MS) {
      console.log('[GPS] Skipping post, moved only', Math.round(distKm * 1000), 'm');
      return;
    }
  }

  useDriverStore.getState().setLocation(lat, lng);

  if (!isOnline) {
    console.log('[GPS] Offline, queueing location');
    await queueLocation(lat, lng);
    return;
  }

  try {
    await postLocation(lat, lng);
    lastPostedLat = lat;
    lastPostedLng = lng;
    lastPostedAt = Date.now();
    console.log('[GPS] Location posted:', lat.toFixed(6), lng.toFixed(6));
  } catch (err) {
    console.log('[GPS] Post failed, queueing:', err);
    await queueLocation(lat, lng);
  }
}

TaskManager.defineTask<BackgroundLocationData>(DRIVER_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.log('[GPS] Background location task error:', error.message);
    return;
  }

  const latest = data?.locations?.at(-1);
  if (!latest) return;

  try {
    if (!(await restoreAuthForBackgroundTask())) {
      console.log('[GPS] Background update skipped: no stored driver session');
      return;
    }
    await sendLocation(latest.coords.latitude, latest.coords.longitude, true);
  } catch (taskError) {
    console.log('[GPS] Background location handling failed:', taskError);
  }
});

export async function startGpsService(): Promise<boolean> {
  if (gpsInterval || gpsStarting) return true;
  gpsStarting = true;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('[GPS] Foreground permission denied');
      return false;
    }

    console.log('[GPS] Starting GPS service');

    const fetchAndSend = async () => {
      try {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const isOnline = useDriverStore.getState().isOnline;
        await sendLocation(location.coords.latitude, location.coords.longitude, isOnline);
      } catch (err) {
        console.log('[GPS] Heartbeat fetch error:', err);
      }
    };

    // Send immediately after session restoration, then keep an independent
    // heartbeat on every platform so a stationary vehicle remains fresh.
    await fetchAndSend();
    gpsInterval = setInterval(() => { void fetchAndSend(); }, HEARTBEAT_INTERVAL_MS);

    if (Platform.OS !== 'web') {
      const backgroundPermission = await Location.getBackgroundPermissionsAsync();
      if (backgroundPermission.status === 'granted') {
        const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
        if (!alreadyStarted) {
          await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
            accuracy: Location.Accuracy.High,
            timeInterval: POST_INTERVAL_MS,
            distanceInterval: 20,
            pausesUpdatesAutomatically: false,
            activityType: Location.ActivityType.AutomotiveNavigation,
            foregroundService: {
              notificationTitle: 'Trotro Driver is sharing location',
              notificationBody: 'Live bus location is active while you are signed in.',
              notificationColor: '#1565C0',
              killServiceOnDestroy: false,
            },
          });
        }
      } else {
        console.log('[GPS] Background permission not granted; screen-off tracking is unavailable');
      }
    }

    return true;
  } catch (err) {
    console.log('[GPS] Failed to start:', err);
    stopGpsService();
    return false;
  } finally {
    gpsStarting = false;
  }
}

export function stopGpsService(): void {
  console.log('[GPS] Stopping GPS service');
  if (Platform.OS !== 'web') {
    void Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK)
      .then(async (started) => {
        if (started) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
      })
      .catch((error) => console.log('[GPS] Failed to stop background task:', error));
  }
  if (gpsInterval) {
    clearInterval(gpsInterval);
    gpsInterval = null;
  }
  lastPostedLat = null;
  lastPostedLng = null;
  lastPostedAt = 0;
}
