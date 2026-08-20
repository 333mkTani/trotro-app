import { create } from 'zustand';
import { clearProfile, clearTokens, getProfile, getTokens, setProfile, setTokens as persistTokens } from '@/services/secureAuthStorage';
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
    await persistTokens({ accessToken, refreshToken: storedRefreshToken });
    set({ accessToken, refreshToken: storedRefreshToken, isAuthenticated: true });
  },

  setUser: async (user: User) => {
    await setProfile(user);
    set({ user });
  },

  clearAuth: async () => {
    await Promise.all([clearTokens(), clearProfile()]);
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  },

  loadStoredAuth: async () => {
    try {
      const [tokens, user] = await Promise.all([getTokens(), getProfile<User>()]);
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
