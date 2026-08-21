import createContextHook from '@nkzw/create-context-hook';
import { clearProfile, getProfile, setProfile } from '@/services/secureAuthStorage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { User } from '@/types';
import { api, setAuthToken, clearAuthToken, onAuthSessionExpired, ApiRequestError } from '@/services/api';

// Ghana numbers only for now: strips spaces/dashes, maps a leading 0 or bare
// 233 to +233, leaves an already-E.164 number untouched.
export const toE164Gh = (raw: string): string => {
  const digits = raw.replace(/[^0-9+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('233')) return `+${digits}`;
  if (digits.startsWith('0')) return `+233${digits.slice(1)}`;
  return `+233${digits}`;
};

// A valid Ghana mobile number is +233 followed by 9 national digits (mobile
// prefixes start with 2 or 5, e.g. 024/054). Checks the normalized form so it
// accepts 024…, 233…, or +233… input alike.
export const isValidGhPhone = (raw: string): boolean => /^\+233[25]\d{8}$/.test(toE164Gh(raw));

type RegisterVerifiedPayload = { fullName: string; email?: string; password: string; role?: string };

type PendingVerification = { confirmation: FirebaseAuthTypes.ConfirmationResult; payload: RegisterVerifiedPayload };

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const queryClient = useQueryClient();

  useEffect(() => onAuthSessionExpired(() => {
    setUser(null);
    void clearProfile();
    queryClient.clear();
  }), [queryClient]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cached = await getProfile<User>();
        if (!mounted) return;
        if (cached) {
          if (mounted) setUser(cached);
          // Re-validate with backend; keep cached session on network failure
          try {
            const { data } = await api.get('/profiles/me');
            if (mounted) {
              setUser(data);
              await setProfile(data);
            }
          } catch (error) {
            // Keep the cached profile only for connectivity failures. An expired
            // token must not leave protected screens looking signed in but empty.
            if (error instanceof ApiRequestError && error.status === 401) {
              await clearProfile();
              if (mounted) setUser(null);
            }
          }
        }
      } catch {
        await clearAuthToken();
        await clearProfile();
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const loginMutation = useMutation({
    mutationFn: async ({ phone, password }: { phone: string; password: string; role?: string }): Promise<User> => {
      const { data } = await api.post('/auth/login', { phone: toE164Gh(phone), password });
      await setAuthToken(data.token);
      const profileRes = await api.get('/profiles/me');
      const profile: User = profileRes.data;
      await setProfile(profile);
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
      await setProfile(profile);
      return profile;
    },
    onSuccess: (u: User) => {
      setUser(u);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null);

  // Kicks off Firebase Phone Auth — sends the SMS via Firebase directly (the
  // backend is never involved in this step). `payload` is the rest of the
  // registration form, held here until confirmPhoneVerification runs.
  const startPhoneVerification = useCallback(async (phone: string, payload: RegisterVerifiedPayload) => {
    const confirmation = await auth().signInWithPhoneNumber(toE164Gh(phone));
    setPendingVerification({ confirmation, payload });
  }, []);

  const confirmMutation = useMutation({
    mutationFn: async (code: string): Promise<User> => {
      if (!pendingVerification) throw new Error('No verification in progress — start again.');
      const result = await pendingVerification.confirmation.confirm(code);
      const idToken = await result?.user.getIdToken();
      const { data } = await api.post('/auth/register-verified', { idToken, ...pendingVerification.payload });
      await setAuthToken(data.token);
      const profileRes = await api.get('/profiles/me');
      const profile: User = profileRes.data;
      await setProfile(profile);
      return profile;
    },
    onSuccess: (u: User) => {
      setUser(u);
      setPendingVerification(null);
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
      await setProfile(data);
      return data as User;
    },
    onSuccess: (updated: User) => {
      setUser(updated);
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      await api.delete('/profiles/me');
      await clearAuthToken();
      await clearProfile();
    },
    onSuccess: () => {
      setUser(null);
      queryClient.clear();
    },
  });

  const logout = useCallback(async () => {
    await clearAuthToken();
    await clearProfile();
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
    pendingVerification,
    startPhoneVerification,
    confirmPhoneVerification: confirmMutation.mutateAsync,
    confirmPhoneVerificationPending: confirmMutation.isPending,
    logout,
    deleteAccount: deleteAccountMutation.mutateAsync,
    deleteAccountPending: deleteAccountMutation.isPending,
    updateProfile: updateProfileMutation.mutateAsync,
    updateProfilePending: updateProfileMutation.isPending,
  };
});
