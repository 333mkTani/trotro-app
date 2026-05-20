export type DrivingStatus = 'STATIONARY' | 'EN_ROUTE';

export interface AutoAcceptedBooking {
  id: string;
  passenger_name: string;
  pickup_stop: string;
  destination_stop: string;
  seats_taken: number;
  auto_accepted_at: string;
}

export interface User {
  id: string;
  phone: string;
  full_name: string;
  role: string;
  avatar_url?: string;
  email?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface DriverDashboard {
  driver_name: string;
  bus_registration: string;
  is_available: boolean;
  available_seats: number;
  total_seats: number;
  assigned_route: Route | null;
  todays_trips: number;
  pending_booking_count: number;
  demand_score: number;
  scheduling_hours: SchedulingHours | null;
}

export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
}

export interface RouteChangeEligibility {
  canChange: boolean;
  reasons: string[];
}

export interface AvailableRoute {
  id: string;
  name: string;
  origin: string;
  destination: string;
  distance_km: number;
  estimated_duration_min: number;
  demand_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SchedulingHours {
  start_time: string;
  end_time: string;
}

export interface Booking {
  id: string;
  passenger_name: string;
  pickup_stop: string;
  destination_stop: string;
  desired_arrival_time: string;
  buffer_minutes: number;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'DECLINED' | 'CANCELLED';
  created_at: string;
}

export interface DemandStop {
  id: string;
  stop_name: string;
  lat: number;
  lng: number;
  demand_count: number;
  distance_km: number;
}

export interface OverflowRequest {
  id: string;
  stop_name: string;
  pickup_stop: string;
  demand_count: number;
  distance_km: number;
  time_posted: string;
  expires_at: string;
  lat: number;
  lng: number;
  status: 'OPEN' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
  passenger_name?: string;
  destination_stop?: string;
}

export interface VerificationResult {
  success: boolean;
  passenger_name?: string;
  route_name?: string;
  confirmed_at?: string;
  error_code?: 'CODE_NOT_FOUND' | 'CODE_EXPIRED' | 'CODE_ALREADY_USED' | 'BUS_MISMATCH' | 'CODE_INVALIDATED';
}

export interface QueuedLocation {
  lat: number;
  lng: number;
  timestamp: number;
}

export interface WalletBalance {
  available: number;
  pending: number;
  currency: string;
}

export interface WalletTransaction {
  id: string;
  type: 'TRIP_EARNING' | 'WITHDRAWAL' | 'BONUS' | 'REFUND';
  amount: number;
  currency: string;
  description: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  created_at: string;
  reference?: string;
}

export interface WithdrawalRequest {
  amount: number;
  method: 'MOBILE_MONEY' | 'BANK_TRANSFER';
  account_number: string;
  account_name: string;
  provider?: string;
}

export interface PaystackInitResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifyResponse {
  status: boolean;
  reference: string;
  amount: number;
  currency: string;
  channel: string;
}

export type SeatEventType = 'BOARDING' | 'ALIGHTING' | 'SYSTEM_ADJUSTMENT' | 'VERIFICATION';

export interface SeatEvent {
  id: string;
  type: SeatEventType;
  seats_changed: number;
  passenger_name?: string;
  timestamp: string;
  source: 'SYSTEM' | 'DRIVER';
}

export interface SeatSyncData {
  available_seats: number;
  total_seats: number;
  last_updated: string;
  recent_events: SeatEvent[];
  has_system_update: boolean;
}
