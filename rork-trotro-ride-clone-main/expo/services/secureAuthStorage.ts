import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'trotro.auth.access_token.v1';
const LEGACY_ACCESS_TOKEN_KEY = 'auth_token';
const PROFILE_KEY = 'trotro.auth.profile.v1';
const LEGACY_PROFILE_KEY = 'trotro_auth_profile';

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  await AsyncStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
}

export async function getAccessToken(): Promise<string | null> {
  const secureToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (secureToken) return secureToken;

  const legacyToken = await AsyncStorage.getItem(LEGACY_ACCESS_TOKEN_KEY);
  if (!legacyToken) return null;
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, legacyToken);
  await AsyncStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  return legacyToken;
}

export async function clearAccessToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await AsyncStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
}

export async function setProfile(profile: unknown): Promise<void> {
  await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(profile));
  await AsyncStorage.removeItem(LEGACY_PROFILE_KEY);
}

export async function getProfile<T>(): Promise<T | null> {
  const secureProfile = await SecureStore.getItemAsync(PROFILE_KEY);
  if (secureProfile) return JSON.parse(secureProfile) as T;
  const legacyProfile = await AsyncStorage.getItem(LEGACY_PROFILE_KEY);
  if (!legacyProfile) return null;
  await SecureStore.setItemAsync(PROFILE_KEY, legacyProfile);
  await AsyncStorage.removeItem(LEGACY_PROFILE_KEY);
  return JSON.parse(legacyProfile) as T;
}

export async function clearProfile(): Promise<void> {
  await SecureStore.deleteItemAsync(PROFILE_KEY);
  await AsyncStorage.removeItem(LEGACY_PROFILE_KEY);
}
