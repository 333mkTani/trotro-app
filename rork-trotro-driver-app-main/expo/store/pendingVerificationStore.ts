import { create } from 'zustand';
import { FirebaseAuthTypes } from '@react-native-firebase/auth';

export interface RegisterVerifiedPayload {
  fullName: string;
  password: string;
  busRegistration?: string;
  routeId?: string;
  totalSeats?: number;
}

interface PendingVerificationState {
  confirmation: FirebaseAuthTypes.ConfirmationResult | null;
  payload: RegisterVerifiedPayload | null;
  set: (confirmation: FirebaseAuthTypes.ConfirmationResult, payload: RegisterVerifiedPayload) => void;
  clear: () => void;
}

export const usePendingVerificationStore = create<PendingVerificationState>((set) => ({
  confirmation: null,
  payload: null,
  set: (confirmation, payload) => set({ confirmation, payload }),
  clear: () => set({ confirmation: null, payload: null }),
}));
