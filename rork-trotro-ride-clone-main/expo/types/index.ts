export type UserRole = 'passenger' | 'admin';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'expired';

export type BusStopType = 'stop' | 'station';


export type CodeStatus = 'valid' | 'used' | 'expired' | 'invalidated';

export type BufferMinutes = 10 | 15 | 20;

export interface User {
  id: string;
  phone: string;
  full_name: string;
  email?: string;
  avatar_url?: string;
  role: UserRole;
  fcm_token?: string;
  created_at: string;
}

export interface BusStop {
  id: string;
  name: string;
  type: BusStopType;
  lat: number;
  lng: number;
  status: 'active' | 'paused' | 'deleted';
  distance_m?: number;
  approaching_buses?: ApproachingBus[];
}

export interface ApproachingBus {
  driver_id: string;
  bus_registration: string;
  driver_name: string;
  seats_available: number;
  eta_minutes: number;
  route_name: string;
  lat: number;
  lng: number;
}

export interface Route {
  id: string;
  name: string;
  origin: string;
  destination: string;
  stops_sequence: string[];
  distance_km: number;
  duration_min: number;
  fare: number;
  status: 'active' | 'paused' | 'deleted';
}


export interface RideSchedule {
  days: DayOfWeek[];
  time_mode: ScheduleTimeMode;
  same_hour?: number;
  same_minute?: number;
  custom_times?: DayTimeEntry[];
  buffer_minutes: BufferMinutes;
}

export interface Booking {
  id: string;
  passenger_id: string;
  driver_id?: string;
  driver_name?: string;
  bus_registration?: string;
  pickup_stop_id: string;
  pickup_stop_name: string;
  destination_stop_id: string;
  destination_stop_name: string;
  desired_arrival_time: string;
  buffer_minutes: BufferMinutes;
  status: BookingStatus;
  notification_sent_at?: string;
  confirmed_at?: string;
  completed_at?: string;
  created_at: string;
  route_name?: string;
  ride_payment_method?: RidePaymentMethod;
  ride_fare?: number;
  ride_schedule?: RideSchedule;
  verification_code?: string;
  code_valid_until?: string;
}

export interface VerificationCode {
  code: string;
  booking_id: string;
  valid_until: string;
  status: CodeStatus;
  passenger_name?: string;
  route_name?: string;
  pickup_stop?: string;
  destination_stop?: string;
}

export interface DemandStop {
  stop_id: string;
  stop_name: string;
  lat: number;
  lng: number;
  demand_count: number;
  distance_m?: number;
}


export interface SchedulingRules {
  booking_window_start: string;
  booking_window_end: string;
  min_advance_minutes: number;
  notification_trigger_km: number;
  allowed_buffer_options: number[];
}

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

export type ScheduleTimeMode = 'same' | 'custom';

export interface DayTimeEntry {
  day: DayOfWeek;
  hour: number;
  minute: number;
}

export interface AlertSchedule {
  days: DayOfWeek[];
  time_mode: ScheduleTimeMode;
  same_hour?: number;
  same_minute?: number;
  custom_times?: DayTimeEntry[];
}

export interface BusAlert {
  id: string;
  route_id: string;
  route_name: string;
  stop_id: string;
  stop_name: string;
  alert_time: string;
  is_active: boolean;
  triggered: boolean;
  created_at: string;
  triggered_buses?: ApproachingBus[];
  schedule?: AlertSchedule;
  last_triggered_day?: string;
}

export type TransactionType = 'top_up' | 'ride_payment' | 'driver_payment' | 'refund';

export type TransactionStatus = 'completed' | 'pending' | 'failed';

export type RidePaymentMethod = 'wallet' | 'cash';

export type PaymentMethod = 'momo_mtn' | 'momo_vodafone' | 'momo_airteltigo' | 'card' | 'bank';

export interface WalletTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  status: TransactionStatus;
  payment_method?: PaymentMethod;
  reference?: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
