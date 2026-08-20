import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKENS_KEY = 'trotro.auth.tokens.v1';
const PROFILE_KEY = 'trotro.auth.profile.v1';
const LEGACY_TOKENS_KEY = 'auth_tokens';
const LEGACY_PROFILE_KEY = 'auth_user';

export type StoredTokens = { accessToken: string; refreshToken: string | null };

export async function setTokens(tokens: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(tokens));
  await AsyncStorage.removeItem(LEGACY_TOKENS_KEY);
}

export async function getTokens(): Promise<StoredTokens | null> {
  const secureTokens = await SecureStore.getItemAsync(TOKENS_KEY);
  if (secureTokens) return JSON.parse(secureTokens) as StoredTokens;
  const legacyTokens = await AsyncStorage.getItem(LEGACY_TOKENS_KEY);
  if (!legacyTokens) return null;
  const parsed = JSON.parse(legacyTokens) as StoredTokens;
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(parsed));
  await AsyncStorage.removeItem(LEGACY_TOKENS_KEY);
  return parsed;
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKENS_KEY);
  await AsyncStorage.removeItem(LEGACY_TOKENS_KEY);
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
