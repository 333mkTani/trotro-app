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

const MAX_429_RETRIES = 2;

const isIdempotentRequest = (method?: string) =>
  ['get', 'head', 'options'].includes((method ?? 'get').toLowerCase());

/**
 * `Retry-After` is either a delay in seconds or an HTTP date. Anything missing
 * or unparseable falls back to a fixed wait rather than 0 — retrying instantly
 * against a limiter that just rejected us only burns the next window too. The
 * upper clamp keeps a hostile or mistaken header from parking a screen for
 * minutes.
 */
const retryAfterMs = (value: unknown): number => {
  if (typeof value !== 'string' && typeof value !== 'number') return 1000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.min(Math.max(seconds * 1000, 1000), 30_000);
  const date = new Date(String(value)).getTime();
  return Number.isFinite(date) ? Math.min(Math.max(date - Date.now(), 1000), 30_000) : 1000;
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const cfg = error.config as (typeof error.config & {
      _retries?: number;
      _rateLimitRetries?: number;
      _timeoutRetries?: number;
    }) | undefined;

    if (status === 401) {
      await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      sessionExpiredListeners.forEach((listener) => listener());
    }

    // Render.com free tier returns 503 while the server cold-starts (can take ~60s).
    // Retry automatically so the user doesn't have to keep tapping.
    if (status === 503 && cfg && isIdempotentRequest(cfg.method)) {
      cfg._retries = (cfg._retries ?? 0) + 1;
      if (cfg._retries <= MAX_503_RETRIES) {
        await new Promise<void>((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return api.request(cfg);
      }
      return Promise.reject(
        new Error('Server is starting up. Please wait a moment and try again.')
      );
    }

    // Honour the server's reset window, but only repeat safe reads. Booking,
    // payment and cancellation mutations must never be replayed automatically.
    if (status === 429 && cfg && isIdempotentRequest(cfg.method)) {
      cfg._rateLimitRetries = (cfg._rateLimitRetries ?? 0) + 1;
      if (cfg._rateLimitRetries <= MAX_429_RETRIES) {
        await new Promise<void>((resolve) => setTimeout(
          resolve,
          retryAfterMs(error.response?.headers?.['retry-after']),
        ));
        return api.request(cfg);
      }
    }

    // A sleeping Render service may stall until Axios times out instead of
    // returning 503. Retry one safe read after a short pause.
    if (error.code === 'ECONNABORTED' && cfg && isIdempotentRequest(cfg.method)) {
      cfg._timeoutRetries = (cfg._timeoutRetries ?? 0) + 1;
      if (cfg._timeoutRetries <= 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 2000));
        return api.request(cfg);
      }
    }

    const message = status === 429
      ? 'The service is busy. Please wait a moment and try again.'
      : error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'An error occurred';
    return Promise.reject(new ApiRequestError(message, status));
  }
);

export const setAuthToken = (token: string) => AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
export const clearAuthToken = () => AsyncStorage.removeItem(AUTH_TOKEN_KEY);
export const getAuthToken = () => AsyncStorage.getItem(AUTH_TOKEN_KEY);
