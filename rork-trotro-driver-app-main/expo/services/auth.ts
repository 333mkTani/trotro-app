import { useAuthStore } from '@/store/authStore';
import api from './api';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    phone: string;
    full_name: string;
    role: string;
  };
}

async function fetchProfile(token: string): Promise<AuthResponse['user']> {
  const { data } = await api.get('/profiles/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return {
    id: data.id,
    phone: data.phone,
    full_name: data.full_name,
    role: data.role,
  };
}

export async function login(phone: string, password: string): Promise<AuthResponse> {
  try {
    const { data } = await api.post('/auth/login', { phone, password });
    const token: string = data.token;
    const user = await fetchProfile(token);

    const store = useAuthStore.getState();
    store.setTokens(token, '');
    store.setUser(user);

    return { access_token: token, refresh_token: '', user };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Login failed. Please try again.');
  }
}

export async function register(
  phone: string,
  password: string,
  fullName: string,
  busRegistration?: string,
  routeId?: string,
  totalSeats?: number,
): Promise<AuthResponse> {
  try {
    const { data } = await api.post('/auth/register', {
      phone, password, fullName, role: 'driver',
      busRegistration, routeId, totalSeats,
    });
    const token: string = data.token;
    const user = await fetchProfile(token);

    const store = useAuthStore.getState();
    store.setTokens(token, '');
    store.setUser(user);

    return { access_token: token, refresh_token: '', user };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Registration failed. Please try again.');
  }
}

export async function logout(): Promise<void> {
  useAuthStore.getState().clearAuth();
}

export async function refreshToken(): Promise<void> {
  // Backend issues long-lived tokens (7 days). On 401, clear auth and let
  // the user log in again rather than attempting a separate refresh call.
  useAuthStore.getState().clearAuth();
}
