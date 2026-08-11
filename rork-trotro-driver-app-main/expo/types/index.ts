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
  driving_status: DrivingStatus;
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

export interface DriverDepartureSlot {
  id: string;
  driver_id: string;
  bus_id: string;
  route_id: string;
  departure_stop_id: string;
  destination_stop_id: string;
  travel_days: string[];
  boarding_start_local: string;
  boarding_end_local: string;
  timezone: 'Africa/Accra';
  status: 'active' | 'paused';
}

export interface RouteStop {
  id: string;
  name: string;
  sequence: number;
}

export type FutureRideRequestStatus =
  | 'pending'
  | 'offered'
  | 'accepted'
  | 'boarding_open'
  | 'boarded'
  | 'departed'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'unmatched';

export interface FutureRideRequest {
  id: string;
  serviceDate: string;
  boardingStart: string;
  boardingEnd: string;
  departureStopId: string;
  passengerName: string;
  routeName: string;
  departureStation: string;
  destinationStation: string;
  availableSeats: number;
  primaryDeadline: string;
  finalDeadline: string;
  backupMatchingEnabled: boolean;
  status: FutureRideRequestStatus;
  driverResponse?: 'accepted' | 'declined' | 'withdrawn';
  busRegistration?: string;
}

export interface ScheduledBoardingResult {
  booking: {
    id: string;
    status: string;
    passenger_id?: string;
    passenger_name?: string;
    pickup_stop_name?: string;
    destination_stop_name?: string;
  };
  occurrence?: {
    id: string;
    status: string;
  };
  occurrenceId?: string;
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
  status: 'OPEN' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CONFIRMED';
  passenger_name?: string;
  destination_stop?: string;
}

export interface VerificationResult {
    success: boolean;
    source?: 'IMMEDIATE' | 'SCHEDULED';
    passenger_name?: string;
    route_name?: string;
    confirmed_at?: string;
    payment_status?: 'unpaid' | 'deposit_pending' | 'deposit_paid' | 'balance_pending' | 'fully_paid' | 'refund_pending' | 'refunded';
    remaining_balance?: number;
  error_code?: 'CODE_NOT_FOUND' | 'CODE_EXPIRED' | 'CODE_ALREADY_USED' | 'BUS_MISMATCH' | 'CODE_INVALIDATED' | 'BOARDING_NOT_OPEN' | 'WRONG_DRIVER';
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
  type: 'TRIP_EARNING' | 'NO_SHOW_COMPENSATION' | 'WITHDRAWAL' | 'BONUS' | 'REFUND';
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
