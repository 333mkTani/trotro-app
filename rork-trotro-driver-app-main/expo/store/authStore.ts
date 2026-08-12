import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setTokens: (accessToken: string, refreshToken?: string | null) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  clearAuth: () => Promise<void>;
  loadStoredAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens: async (accessToken: string, refreshToken?: string | null) => {
    const storedRefreshToken = refreshToken || null;
    await AsyncStorage.setItem(
      'auth_tokens',
      JSON.stringify({ accessToken, refreshToken: storedRefreshToken }),
    );
    set({ accessToken, refreshToken: storedRefreshToken, isAuthenticated: true });
  },

  setUser: async (user: User) => {
    await AsyncStorage.setItem('auth_user', JSON.stringify(user));
    set({ user });
  },

  clearAuth: async () => {
    await AsyncStorage.multiRemove(['auth_tokens', 'auth_user']);
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },

  loadStoredAuth: async () => {
    try {
      const [tokensJson, userJson] = await AsyncStorage.multiGet(['auth_tokens', 'auth_user']);
      const tokens = tokensJson[1] ? JSON.parse(tokensJson[1]) : null;
      const user = userJson[1] ? JSON.parse(userJson[1]) : null;
      // The current backend issues a single JWT rather than an access/refresh
      // pair. A persisted access token is therefore sufficient to restore the
      // session after Android removes the app from Recents or restarts it.
      if (tokens?.accessToken) {
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user,
          isAuthenticated: true,
          isLoading: false,
        });
        console.log('[AuthStore] Restored auth from storage');
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.log('[AuthStore] Error loading stored auth:', err);
      set({ isLoading: false });
    }
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
