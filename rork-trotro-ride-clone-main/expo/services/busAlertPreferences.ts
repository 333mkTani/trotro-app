import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

export const BUS_ALERTS_ENABLED_KEY = 'trotro_bus_alerts_enabled';

export async function getBusAlertsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem(BUS_ALERTS_ENABLED_KEY)) !== 'false';
}

export async function setBusAlertsEnabled(enabled: boolean): Promise<void> {
  await api.patch('/profiles/me', { busAlertsEnabled: enabled });
  await AsyncStorage.setItem(BUS_ALERTS_ENABLED_KEY, String(enabled));
}

export async function hydrateBusAlertsEnabled(): Promise<boolean> {
  try {
    const { data } = await api.get('/profiles/me');
    const enabled = data.bus_alerts_enabled !== false;
    await AsyncStorage.setItem(BUS_ALERTS_ENABLED_KEY, String(enabled));
    return enabled;
  } catch {
    return getBusAlertsEnabled();
  }
}
