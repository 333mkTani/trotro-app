import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueuedLocation } from '@/types';
import { postLocation } from './driverApi';

const QUEUE_KEY = 'gps_offline_queue';
const MAX_QUEUE_SIZE = 5;

export async function enqueueLocation(lat: number, lng: number): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: QueuedLocation[] = stored ? JSON.parse(stored) : [];
    queue.push({ lat, lng, timestamp: Date.now() });
    while (queue.length > MAX_QUEUE_SIZE) {
      queue.shift();
    }
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    console.log('[OfflineQueue] Enqueued location, queue size:', queue.length);
  } catch (err) {
    console.log('[OfflineQueue] Failed to enqueue:', err);
  }
}

export async function flushQueue(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    if (!stored) return;
    const queue: QueuedLocation[] = JSON.parse(stored);
    if (queue.length === 0) return;

    console.log('[OfflineQueue] Flushing queue, entries:', queue.length);
    for (const entry of queue) {
      try {
        await postLocation(entry.lat, entry.lng);
      } catch (err) {
        console.log('[OfflineQueue] Failed to flush entry:', err);
        return;
      }
    }
    await AsyncStorage.removeItem(QUEUE_KEY);
    console.log('[OfflineQueue] Queue flushed successfully');
  } catch (err) {
    console.log('[OfflineQueue] Failed to flush queue:', err);
  }
}

export async function getQueueSize(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_KEY);
    if (!stored) return 0;
    const queue: QueuedLocation[] = JSON.parse(stored);
    return queue.length;
  } catch {
    return 0;
  }
}
