import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { useDriverStore } from '@/store/driverStore';
import { postLocation } from './driverApi';
import { enqueueLocation } from './offlineQueue';
import { haversineDistance } from '@/utils/helpers';

let locationSubscription: Location.LocationSubscription | null = null;
let gpsInterval: ReturnType<typeof setInterval> | null = null;
let lastPostedLat: number | null = null;
let lastPostedLng: number | null = null;
let lastPostedAt = 0;
let gpsStarting = false;
const MIN_DISTANCE_M = 50;
const POST_INTERVAL_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 60000;

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
    await enqueueLocation(lat, lng);
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
    await enqueueLocation(lat, lng);
  }
}

export async function startGpsService(): Promise<boolean> {
  if (locationSubscription || gpsInterval || gpsStarting) return true;
  gpsStarting = true;
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('[GPS] Foreground permission denied');
      return false;
    }

    if (Platform.OS !== 'web') {
      const bgStatus = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus.status !== 'granted') {
        console.log('[GPS] Background permission denied (continuing with foreground only)');
      }
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
      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: POST_INTERVAL_MS,
          distanceInterval: 0,
        },
        (location) => {
          const isOnline = useDriverStore.getState().isOnline;
          sendLocation(location.coords.latitude, location.coords.longitude, isOnline);
        }
      );
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
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
  if (gpsInterval) {
    clearInterval(gpsInterval);
    gpsInterval = null;
  }
  lastPostedLat = null;
  lastPostedLng = null;
  lastPostedAt = 0;
}
