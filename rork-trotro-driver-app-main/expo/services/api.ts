import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';

// Change this to your deployed backend URL for production.
// For local development with a physical device, use your machine's LAN IP:
//   e.g. http://192.168.1.100:4000
export const API_BASE_URL = 'https://trotro-api.onrender.com';

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
  _rateLimitRetries?: number;
}

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

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
  },
  (error: unknown) => Promise.reject(error)
);

api.interceptors.response.use(
  (response: import('axios').AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableConfig | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const currentToken = useAuthStore.getState().accessToken;
      const requestAuthorization = originalRequest.headers?.Authorization;
      // A delayed 401 from a request made with an older token must not erase
      // a newer session established while that request was in flight.
      if (!currentToken || requestAuthorization === `Bearer ${currentToken}`) {
        await useAuthStore.getState().clearAuth();
      }
      return Promise.reject(error);
    }

    // The API caps requests per minute. Wait out the window the server names
    // rather than surfacing a bare failure, but only replay safe reads — a
    // trip start, seat confirmation or payment must never be sent twice.
    if (error.response?.status === 429 && originalRequest && isIdempotentRequest(originalRequest.method)) {
      originalRequest._rateLimitRetries = (originalRequest._rateLimitRetries ?? 0) + 1;
      if (originalRequest._rateLimitRetries <= MAX_429_RETRIES) {
        await new Promise<void>((resolve) => setTimeout(
          resolve,
          retryAfterMs(error.response?.headers?.['retry-after']),
        ));
        return api.request(originalRequest);
      }
      return Promise.reject(new Error('The service is busy. Please wait a moment and try again.'));
    }

    if (!error.response) {
      const networkError = new Error('Connection error. Please check your internet.') as Error & { code: string };
      networkError.code = 'NETWORK_ERROR';
      return Promise.reject(networkError);
    }

    if (error.code === 'ECONNABORTED') {
      const timeoutError = new Error('Request timed out. Please try again.') as Error & { code: string };
      timeoutError.code = 'TIMEOUT';
      return Promise.reject(timeoutError);
    }

    const message =
      (error.response?.data as Record<string, unknown>)?.message as string ||
      error.message ||
      'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export default api;
