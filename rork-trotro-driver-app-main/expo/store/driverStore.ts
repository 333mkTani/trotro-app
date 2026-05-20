import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Route, DrivingStatus, AutoAcceptedBooking } from '@/types';

interface DriverState {
  isAvailable: boolean;
  availableSeats: number;
  totalSeats: number;
  assignedRoute: Route | null;
  pendingBookingCount: number;
  demandScore: number;
  todaysTrips: number;
  driverName: string;
  busRegistration: string;
  currentLat: number | null;
  currentLng: number | null;
  isOnline: boolean;
  schedulingHours: { start_time: string; end_time: string } | null;
  drivingStatus: DrivingStatus;
  autoAcceptedBookings: AutoAcceptedBooking[];
  isProSubscriber: boolean;
  proExpiresAt: string | null;
  setDrivingStatus: (status: DrivingStatus) => void;
  addAutoAcceptedBooking: (booking: AutoAcceptedBooking) => void;
  clearAutoAcceptedBookings: () => void;
  setAvailability: (isAvailable: boolean) => void;
  updateSeats: (available: number, total: number) => void;
  setRoute: (route: Route | null) => void;
  setLocation: (lat: number, lng: number) => void;
  setOnlineStatus: (isOnline: boolean) => void;
  setDashboardData: (data: Partial<DriverState>) => void;
  setProSubscription: (isPro: boolean, expiresAt?: string | null) => void;
}

export const useDriverStore = create<DriverState>((set) => ({
  isAvailable: false,
  availableSeats: 0,
  totalSeats: 14,
  assignedRoute: null,
  pendingBookingCount: 0,
  demandScore: 0,
  todaysTrips: 0,
  driverName: '',
  busRegistration: '',
  currentLat: null,
  currentLng: null,
  isOnline: true,
  schedulingHours: null,
  drivingStatus: 'STATIONARY' as DrivingStatus,
  autoAcceptedBookings: [],
  isProSubscriber: false,
  proExpiresAt: null,

  setDrivingStatus: (status: DrivingStatus) => {
    console.log('[DriverStore] Driving status changed to:', status);
    set({ drivingStatus: status });
    if (status === 'STATIONARY') {
      console.log('[DriverStore] Driver is stationary — manual accept mode');
    } else {
      console.log('[DriverStore] Driver is en route — auto-accept mode');
    }
  },
  addAutoAcceptedBooking: (booking: AutoAcceptedBooking) =>
    set((state) => ({
      autoAcceptedBookings: [...state.autoAcceptedBookings, booking],
      availableSeats: Math.max(0, state.availableSeats - booking.seats_taken),
    })),
  clearAutoAcceptedBookings: () => set({ autoAcceptedBookings: [] }),

  setAvailability: (isAvailable: boolean) => set({ isAvailable }),
  updateSeats: (available: number, total: number) => set({ availableSeats: available, totalSeats: total }),
  setRoute: (route: Route | null) => set({ assignedRoute: route }),
  setLocation: (lat: number, lng: number) => set({ currentLat: lat, currentLng: lng }),
  setOnlineStatus: (isOnline: boolean) => set({ isOnline }),
  setDashboardData: (data: Partial<DriverState>) => set(data),
  setProSubscription: (isPro: boolean, expiresAt?: string | null) => {
    set({ isProSubscriber: isPro, proExpiresAt: expiresAt ?? null });
    AsyncStorage.setItem('pro_subscription', JSON.stringify({ isPro, expiresAt: expiresAt ?? null })).catch(
      (err) => console.log('[DriverStore] Failed to persist pro status:', err)
    );
  },
}));
