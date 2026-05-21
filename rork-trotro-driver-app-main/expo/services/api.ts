import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';

// Change this to your deployed backend URL for production.
// For local development with a physical device, use your machine's LAN IP:
//   e.g. http://192.168.1.100:4000
export const API_BASE_URL = 'https://trotro-api.onrender.com';

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

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
      useAuthStore.getState().clearAuth();
      return Promise.reject(error);
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
