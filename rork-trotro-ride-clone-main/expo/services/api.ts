import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your deployed backend URL when deploying to production.
// For local development with a device on the same network, use your machine's LAN IP:
//   e.g. http://192.168.1.100:4000
export const API_BASE_URL = 'https://trotro-api.onrender.com';

const AUTH_TOKEN_KEY = 'auth_token';

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'An error occurred';
    return Promise.reject(new Error(message));
  }
);

export const setAuthToken = (token: string) => AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
export const clearAuthToken = () => AsyncStorage.removeItem(AUTH_TOKEN_KEY);
export const getAuthToken = () => AsyncStorage.getItem(AUTH_TOKEN_KEY);
