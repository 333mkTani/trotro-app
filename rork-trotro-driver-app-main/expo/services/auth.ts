import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { useAuthStore } from '@/store/authStore';
import { RegisterVerifiedPayload } from '@/store/pendingVerificationStore';
import api from './api';

// Ghana numbers only for now: strips spaces/dashes, maps a leading 0 or bare
// 233 to +233, leaves an already-E.164 number untouched.
export const toE164Gh = (raw: string): string => {
  const digits = raw.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('233')) return `+${digits}`;
  if (digits.startsWith('0')) return `+233${digits.slice(1)}`;
  return `+233${digits}`;
};

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
    const { data } = await api.post('/auth/login', { phone: toE164Gh(phone), password });
    const token: string = data.token;
    const user = await fetchProfile(token);

    const store = useAuthStore.getState();
    await store.setTokens(token);
    await store.setUser(user);

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
    await store.setTokens(token);
    await store.setUser(user);

    return { access_token: token, refresh_token: '', user };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Registration failed. Please try again.');
  }
}

// Kicks off Firebase Phone Auth — the SMS is sent by Firebase directly to
// the device; the backend is never involved in this step.
export async function startPhoneVerification(phone: string): Promise<FirebaseAuthTypes.ConfirmationResult> {
  try {
    return await auth().signInWithPhoneNumber(toE164Gh(phone));
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Could not send verification code. Please try again.');
  }
}

// Called after confirmation.confirm(code) succeeds and yields a Firebase ID
// token proving the phone was verified.
export async function registerVerifiedPhone(idToken: string, payload: RegisterVerifiedPayload): Promise<AuthResponse> {
  try {
    const { data } = await api.post('/auth/register-verified', {
      idToken,
      fullName: payload.fullName,
      password: payload.password,
      role: 'driver',
      busRegistration: payload.busRegistration,
      routeId: payload.routeId,
      totalSeats: payload.totalSeats,
    });
    const token: string = data.token;
    const user = await fetchProfile(token);

    const store = useAuthStore.getState();
    await store.setTokens(token);
    await store.setUser(user);

    return { access_token: token, refresh_token: '', user };
  } catch (error: unknown) {
    if (error instanceof Error) throw error;
    throw new Error('Verification failed. Please try again.');
  }
}

export async function logout(): Promise<void> {
  try {
    await api.patch('/drivers/me/availability', { isAvailable: false });
  } catch (error) {
    // A stale-heartbeat cutoff still removes the bus if this best-effort call
    // cannot complete because the device is offline.
    console.log('[Auth] Could not mark bus unavailable during logout:', error);
  } finally {
    await useAuthStore.getState().clearAuth();
  }
}
