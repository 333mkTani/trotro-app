import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '@/types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  loadStoredAuth: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens: (accessToken: string, refreshToken: string) => {
    set({ accessToken, refreshToken, isAuthenticated: true });
    AsyncStorage.setItem('auth_tokens', JSON.stringify({ accessToken, refreshToken })).catch(
      (err) => console.log('[AuthStore] Failed to persist tokens:', err)
    );
  },

  setUser: (user: User) => {
    set({ user });
    AsyncStorage.setItem('auth_user', JSON.stringify(user)).catch(
      (err) => console.log('[AuthStore] Failed to persist user:', err)
    );
  },

  clearAuth: () => {
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
    AsyncStorage.multiRemove(['auth_tokens', 'auth_user']).catch(
      (err) => console.log('[AuthStore] Failed to clear stored auth:', err)
    );
  },

  loadStoredAuth: async () => {
    try {
      const [tokensJson, userJson] = await AsyncStorage.multiGet(['auth_tokens', 'auth_user']);
      const tokens = tokensJson[1] ? JSON.parse(tokensJson[1]) : null;
      const user = userJson[1] ? JSON.parse(userJson[1]) : null;
      if (tokens?.accessToken && tokens?.refreshToken) {
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
