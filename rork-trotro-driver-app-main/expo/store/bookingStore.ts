import { create } from 'zustand';
import { Booking, OverflowRequest } from '@/types';

interface BookingState {
  upcomingBookings: Booking[];
  overflowRequests: OverflowRequest[];
  lastFetched: number | null;
  setBookings: (bookings: Booking[]) => void;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => void;
  setOverflowRequests: (requests: OverflowRequest[]) => void;
  updateOverflowStatus: (requestId: string, status: OverflowRequest['status']) => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  upcomingBookings: [],
  overflowRequests: [],
  lastFetched: null,

  setBookings: (bookings: Booking[]) => set({ upcomingBookings: bookings, lastFetched: Date.now() }),

  updateBookingStatus: (bookingId: string, status: Booking['status']) =>
    set((state) => ({
      upcomingBookings: state.upcomingBookings.map((b) =>
        b.id === bookingId ? { ...b, status } : b
      ),
    })),

  setOverflowRequests: (requests: OverflowRequest[]) => set({ overflowRequests: requests }),

  updateOverflowStatus: (requestId: string, status: OverflowRequest['status']) =>
    set((state) => ({
      overflowRequests: state.overflowRequests.map((r) =>
        r.id === requestId ? { ...r, status } : r
      ),
    })),
}));
