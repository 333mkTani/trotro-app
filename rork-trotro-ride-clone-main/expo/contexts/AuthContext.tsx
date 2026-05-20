import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import { User } from '@/types';
import { api, setAuthToken, clearAuthToken } from '@/services/api';

const AUTH_USER_KEY = 'trotro_auth_profile';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_USER_KEY);
        if (!mounted) return;
        if (raw) {
          setUser(JSON.parse(raw) as User);
          // Re-validate with backend
          const { data } = await api.get('/profiles/me');
          if (mounted) {
            setUser(data);
            await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data));
          }
        }
      } catch {
        await clearAuthToken();
        await AsyncStorage.removeItem(AUTH_USER_KEY);
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const loginMutation = useMutation({
    mutationFn: async ({ phone, password }: { phone: string; password: string; role?: string }): Promise<User> => {
      const { data } = await api.post('/auth/login', { phone, password });
      await setAuthToken(data.token);
      const profileRes = await api.get('/profiles/me');
      const profile: User = profileRes.data;
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile));
      return profile;
    },
    onSuccess: (u: User) => {
      setUser(u);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async ({ phone, password, full_name }: { phone: string; password: string; full_name: string; role?: string }): Promise<User> => {
      const { data } = await api.post('/auth/register', {
        phone,
        password,
        fullName: full_name,
        role: 'passenger',
      });
      await setAuthToken(data.token);
      const profileRes = await api.get('/profiles/me');
      const profile: User = profileRes.data;
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(profile));
      return profile;
    },
    onSuccess: (u: User) => {
      setUser(u);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: Partial<Pick<User, 'full_name' | 'phone' | 'email' | 'avatar_url'>>): Promise<User> => {
      const patch: Record<string, string | undefined> = {};
      if (updates.full_name !== undefined) patch.fullName = updates.full_name;
      if (updates.phone !== undefined) patch.phone = updates.phone;
      if (updates.email !== undefined) patch.email = updates.email;
      if (updates.avatar_url !== undefined) patch.avatarUrl = updates.avatar_url;
      const { data } = await api.patch('/profiles/me', patch);
      await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(data));
      return data as User;
    },
    onSuccess: (updated: User) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const logout = useCallback(async () => {
    await clearAuthToken();
    await AsyncStorage.removeItem(AUTH_USER_KEY);
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    loginPending: loginMutation.isPending,
    registerPending: registerMutation.isPending,
    logout,
    updateProfile: updateProfileMutation.mutateAsync,
    updateProfilePending: updateProfileMutation.isPending,
  };
});
