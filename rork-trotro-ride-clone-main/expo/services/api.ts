import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your deployed backend URL when deploying to production.
// For local development with a device on the same network, use your machine's LAN IP:
//   e.g. http://192.168.1.100:4000
export const API_BASE_URL = 'https://trotro-api.onrender.com';

const AUTH_TOKEN_KEY = 'auth_token';

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export class ApiRequestError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export const onAuthSessionExpired = (listener: SessionExpiredListener) => {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
};

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const MAX_503_RETRIES = 3;
const RETRY_DELAY_MS = 20000;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;

    if (status === 401) {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      sessionExpiredListeners.forEach((listener) => listener());
    }

    // Render.com free tier returns 503 while the server cold-starts (can take ~60s).
    // Retry automatically so the user doesn't have to keep tapping.
    if (status === 503) {
      const cfg = error.config as typeof error.config & { _retries?: number };
      cfg._retries = (cfg._retries ?? 0) + 1;
      if (cfg._retries <= MAX_503_RETRIES) {
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return api.request(cfg);
      }
      return Promise.reject(
        new Error('Server is starting up. Please wait a moment and try again.')
      );
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An error occurred';
    return Promise.reject(new ApiRequestError(message, status));
  }
);

export const setAuthToken = (token: string) => AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
export const clearAuthToken = () => AsyncStorage.removeItem(AUTH_TOKEN_KEY);
export const getAuthToken = () => AsyncStorage.getItem(AUTH_TOKEN_KEY);
