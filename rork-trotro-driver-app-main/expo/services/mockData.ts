import { DriverDashboard, Booking, DemandStop, OverflowRequest, VerificationResult, User, WalletBalance, WalletTransaction, AutoAcceptedBooking, SeatSyncData, SeatEvent, AvailableRoute, RouteChangeEligibility, Route } from '@/types';

const MOCK_DELAY = 600;

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

interface StoredAccount {
  phone: string;
  password: string;
  full_name: string;
}

const accounts: StoredAccount[] = [
  { phone: '241234567', password: 'driver123', full_name: 'Kofi Mensah' },
];

export function addAccount(phone: string, password: string, fullName: string) {
  const exists = accounts.find((a) => a.phone === phone);
  if (exists) throw new Error('An account with this phone number already exists.');
  accounts.push({ phone, password, full_name: fullName });
}

export async function mockLogin(phone: string, password: string): Promise<{
  access_token: string;
  refresh_token: string;
  user: User;
}> {
  await delay(MOCK_DELAY);
  const clean = phone.replace(/\s+/g, '').replace(/^\+233/, '');
  const acct = accounts.find((a) => a.phone === clean);
  if (!acct || acct.password !== password) {
    const err: Record<string, unknown> = { response: { data: { error_code: 'INVALID_CREDENTIALS' } } };
    throw err;
  }
  return {
    access_token: 'mock_access_' + Date.now(),
    refresh_token: 'mock_refresh_' + Date.now(),
    user: { id: 'drv_' + clean, phone: clean, full_name: acct.full_name, role: 'driver' },
  };
}

export async function mockRegister(phone: string, password: string, fullName: string): Promise<{
  access_token: string;
  refresh_token: string;
  user: User;
}> {
  await delay(MOCK_DELAY);
  const clean = phone.replace(/\s+/g, '').replace(/^\+233/, '');
  addAccount(clean, password, fullName);
  return {
    access_token: 'mock_access_' + Date.now(),
    refresh_token: 'mock_refresh_' + Date.now(),
    user: { id: 'drv_' + clean, phone: clean, full_name: fullName, role: 'driver' },
  };
}

export async function mockGetDashboard(): Promise<DriverDashboard> {
  await delay(MOCK_DELAY);
  return {
    driver_name: 'Kofi Mensah',
    bus_registration: 'AC-1234-GH',
    is_available: true,
    available_seats: 8,
    total_seats: 14,
    assigned_route: { id: 'r1', name: 'Circle → Kumasi Central', origin: 'Circle', destination: 'Kumasi Central' },
    todays_trips: 4,
    pending_booking_count: 3,
    demand_score: 7,
    scheduling_hours: { start_time: '05:00', end_time: '20:00' },
  };
}

export async function mockGetBookings(): Promise<Booking[]> {
  await delay(MOCK_DELAY);
  const now = new Date();
  return [
    {
      id: 'b1',
      passenger_name: 'Ama Serwaa',
      pickup_stop: 'Kaneshie Market',
      destination_stop: 'Kumasi Central',
      desired_arrival_time: new Date(now.getTime() + 3600000).toISOString(),
      buffer_minutes: 15,
      status: 'PENDING',
      created_at: new Date(now.getTime() - 1800000).toISOString(),
    },
    {
      id: 'b2',
      passenger_name: 'Yaw Boateng',
      pickup_stop: 'Darkuman Junction',
      destination_stop: 'Kumasi Central',
      desired_arrival_time: new Date(now.getTime() + 7200000).toISOString(),
      buffer_minutes: 10,
      status: 'PENDING',
      created_at: new Date(now.getTime() - 900000).toISOString(),
    },
    {
      id: 'b3',
      passenger_name: 'Efua Owusu',
      pickup_stop: 'Odorkor',
      destination_stop: 'Circle',
      desired_arrival_time: new Date(now.getTime() + 10800000).toISOString(),
      buffer_minutes: 20,
      status: 'CONFIRMED',
      created_at: new Date(now.getTime() - 3600000).toISOString(),
    },
  ];
}

export async function mockGetDemandHeatmap(): Promise<DemandStop[]> {
  await delay(MOCK_DELAY);
  return [
    { id: 's1', stop_name: 'Kaneshie Market', lat: 5.5571, lng: -0.2308, demand_count: 8, distance_km: 0.5 },
    { id: 's2', stop_name: 'Darkuman Junction', lat: 5.5651, lng: -0.2451, demand_count: 5, distance_km: 1.2 },
    { id: 's3', stop_name: 'Odorkor', lat: 5.5781, lng: -0.2621, demand_count: 3, distance_km: 2.1 },
    { id: 's4', stop_name: 'Abeka Lapaz', lat: 5.5901, lng: -0.2401, demand_count: 6, distance_km: 1.8 },
    { id: 's5', stop_name: 'Circle', lat: 5.5600, lng: -0.2100, demand_count: 2, distance_km: 0.8 },
  ];
}

let overflowStatuses: Record<string, OverflowRequest['status']> = {};

export async function mockGetOverflowRequests(): Promise<OverflowRequest[]> {
  await delay(MOCK_DELAY);
  const now = new Date();
  return [
    {
      id: 'o1',
      stop_name: 'Kaneshie Market',
      pickup_stop: 'Kaneshie Market Bus Stop',
      destination_stop: 'Kumasi Central',
      demand_count: 1,
      distance_km: 0.5,
      time_posted: new Date(now.getTime() - 180000).toISOString(),
      expires_at: new Date(now.getTime() + 600000).toISOString(),
      lat: 5.5571,
      lng: -0.2308,
      status: overflowStatuses['o1'] || 'OPEN',
      passenger_name: 'Ama Serwaa',
    },
    {
      id: 'o2',
      stop_name: 'Darkuman Junction',
      pickup_stop: 'Darkuman Lorry Station',
      destination_stop: 'Circle',
      demand_count: 1,
      distance_km: 1.2,
      time_posted: new Date(now.getTime() - 300000).toISOString(),
      expires_at: new Date(now.getTime() + 300000).toISOString(),
      lat: 5.5651,
      lng: -0.2451,
      status: overflowStatuses['o2'] || 'OPEN',
      passenger_name: 'Yaw Boateng',
    },
    {
      id: 'o3',
      stop_name: 'Abeka Lapaz',
      pickup_stop: 'Abeka Lapaz Station',
      destination_stop: 'Kaneshie Market',
      demand_count: 1,
      distance_km: 1.8,
      time_posted: new Date(now.getTime() - 120000).toISOString(),
      expires_at: new Date(now.getTime() + 900000).toISOString(),
      lat: 5.5901,
      lng: -0.2401,
      status: overflowStatuses['o3'] || 'OPEN',
      passenger_name: 'Efua Owusu',
    },
    {
      id: 'o4',
      stop_name: 'Odorkor',
      pickup_stop: 'Odorkor Bus Terminal',
      destination_stop: 'Circle',
      demand_count: 1,
      distance_km: 2.1,
      time_posted: new Date(now.getTime() - 90000).toISOString(),
      expires_at: new Date(now.getTime() + 800000).toISOString(),
      lat: 5.5781,
      lng: -0.2621,
      status: overflowStatuses['o4'] || 'OPEN',
      passenger_name: 'Kwame Asante',
    },
    {
      id: 'o5',
      stop_name: 'Circle',
      pickup_stop: 'Circle Station',
      destination_stop: 'Kumasi Central',
      demand_count: 1,
      distance_km: 0.8,
      time_posted: new Date(now.getTime() - 60000).toISOString(),
      expires_at: new Date(now.getTime() + 700000).toISOString(),
      lat: 5.5600,
      lng: -0.2100,
      status: overflowStatuses['o5'] || 'OPEN',
      passenger_name: 'Adwoa Mensah',
    },
  ];
}

export async function mockAcceptOverflowRequest(requestId: string): Promise<void> {
  await delay(MOCK_DELAY);
  overflowStatuses[requestId] = 'ACCEPTED';
  console.log('[MockData] Overflow request accepted:', requestId);
}

export async function mockDeclineOverflowRequest(requestId: string): Promise<void> {
  await delay(MOCK_DELAY);
  overflowStatuses[requestId] = 'DECLINED';
  console.log('[MockData] Overflow request declined:', requestId);
}

export async function mockVerifyCode(code: string): Promise<VerificationResult> {
  await delay(MOCK_DELAY);
  const upper = code.toUpperCase();
  if (upper === 'ABC123') {
    return {
      success: true,
      passenger_name: 'Ama Serwaa',
      route_name: 'Circle → Kumasi Central',
      confirmed_at: new Date().toISOString(),
    };
  }
  if (upper === 'EXP999') {
    return { success: false, error_code: 'CODE_EXPIRED' };
  }
  if (upper === 'USE111') {
    return { success: false, error_code: 'CODE_ALREADY_USED' };
  }
  return { success: false, error_code: 'CODE_NOT_FOUND' };
}

let mockWalletBalance: WalletBalance = {
  available: 847.50,
  pending: 126.00,
  currency: 'GHS',
};

const mockTransactions: WalletTransaction[] = [
  { id: 'tx1', type: 'TRIP_EARNING', amount: 45.00, currency: 'GHS', description: 'Trip: Circle → Kumasi Central', status: 'COMPLETED', created_at: new Date(Date.now() - 1800000).toISOString(), reference: 'TRP-001' },
  { id: 'tx2', type: 'TRIP_EARNING', amount: 32.00, currency: 'GHS', description: 'Trip: Kaneshie → Darkuman', status: 'COMPLETED', created_at: new Date(Date.now() - 7200000).toISOString(), reference: 'TRP-002' },
  { id: 'tx3', type: 'BONUS', amount: 50.00, currency: 'GHS', description: 'Peak hours bonus', status: 'COMPLETED', created_at: new Date(Date.now() - 14400000).toISOString() },
  { id: 'tx4', type: 'WITHDRAWAL', amount: -500.00, currency: 'GHS', description: 'Withdrawal to MTN MoMo •••4567', status: 'COMPLETED', created_at: new Date(Date.now() - 86400000).toISOString(), reference: 'WDR-001' },
  { id: 'tx5', type: 'TRIP_EARNING', amount: 28.00, currency: 'GHS', description: 'Trip: Odorkor → Circle', status: 'COMPLETED', created_at: new Date(Date.now() - 90000000).toISOString(), reference: 'TRP-003' },
  { id: 'tx6', type: 'TRIP_EARNING', amount: 55.00, currency: 'GHS', description: 'Trip: Abeka Lapaz → Kumasi Central', status: 'PENDING', created_at: new Date(Date.now() - 100000000).toISOString(), reference: 'TRP-004' },
  { id: 'tx7', type: 'TRIP_EARNING', amount: 38.50, currency: 'GHS', description: 'Trip: Circle → Kaneshie Market', status: 'COMPLETED', created_at: new Date(Date.now() - 172800000).toISOString(), reference: 'TRP-005' },
  { id: 'tx8', type: 'WITHDRAWAL', amount: -300.00, currency: 'GHS', description: 'Withdrawal to Vodafone Cash •••8901', status: 'COMPLETED', created_at: new Date(Date.now() - 259200000).toISOString(), reference: 'WDR-002' },
  { id: 'tx9', type: 'BONUS', amount: 25.00, currency: 'GHS', description: 'Weekly performance bonus', status: 'COMPLETED', created_at: new Date(Date.now() - 345600000).toISOString() },
  { id: 'tx10', type: 'TRIP_EARNING', amount: 42.00, currency: 'GHS', description: 'Trip: Darkuman → Circle', status: 'COMPLETED', created_at: new Date(Date.now() - 432000000).toISOString(), reference: 'TRP-006' },
];

export async function mockGetWalletBalance(): Promise<WalletBalance> {
  await delay(MOCK_DELAY);
  return { ...mockWalletBalance };
}

export async function mockGetTransactions(): Promise<WalletTransaction[]> {
  await delay(MOCK_DELAY);
  return [...mockTransactions];
}

export async function mockFundWallet(amount: number, channel: string): Promise<WalletTransaction> {
  await delay(1500);
  if (amount < 1) {
    throw new Error('Minimum funding amount is GHS 1.00');
  }
  mockWalletBalance = { ...mockWalletBalance, available: mockWalletBalance.available + amount };
  const tx: WalletTransaction = {
    id: 'tx_f_' + Date.now(),
    type: 'REFUND',
    amount: amount,
    currency: 'GHS',
    description: `Wallet funded via ${channel}`,
    status: 'COMPLETED',
    created_at: new Date().toISOString(),
    reference: 'PS_' + Date.now(),
  };
  mockTransactions.unshift(tx);
  console.log('[MockData] Wallet funded:', amount, channel);
  return tx;
}

export async function mockRequestWithdrawal(amount: number, method: string, accountNumber: string, accountName: string, provider?: string): Promise<WalletTransaction> {
  await delay(1200);
  if (amount > mockWalletBalance.available) {
    throw new Error('Insufficient balance');
  }
  if (amount < 5) {
    throw new Error('Minimum withdrawal is GHS 5.00');
  }
  mockWalletBalance = { ...mockWalletBalance, available: mockWalletBalance.available - amount };
  const tx: WalletTransaction = {
    id: 'tx_w_' + Date.now(),
    type: 'WITHDRAWAL',
    amount: -amount,
    currency: 'GHS',
    description: `Withdrawal to ${provider || method} •••${accountNumber.slice(-4)}`,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    reference: 'WDR-' + Date.now(),
  };
  mockTransactions.unshift(tx);
  console.log('[MockData] Withdrawal requested:', amount, method);
  return tx;
}

export async function mockToggleAvailability(_isAvailable: boolean): Promise<void> {
  await delay(300);
}

export async function mockAcceptBooking(_id: string): Promise<void> {
  await delay(MOCK_DELAY);
}

export async function mockDeclineBooking(_id: string): Promise<void> {
  await delay(MOCK_DELAY);
}

export async function mockUpdateSchedulingHours(_start: string, _end: string): Promise<void> {
  await delay(300);
}

export function resetOverflowStatuses() {
  overflowStatuses = {};
}

const autoAcceptPassengers = [
  { name: 'Akua Donkor', pickup: 'Kaneshie Market', dest: 'Circle' },
  { name: 'Kwesi Appiah', pickup: 'Darkuman Junction', dest: 'Kumasi Central' },
  { name: 'Abena Pokua', pickup: 'Odorkor Bus Stop', dest: 'Kaneshie Market' },
  { name: 'Yaw Frimpong', pickup: 'Abeka Lapaz', dest: 'Circle' },
  { name: 'Esi Mensah', pickup: 'Circle Station', dest: 'Kumasi Central' },
];

let autoAcceptIdx = 0;

export async function mockAutoAcceptBooking(availableSeats: number): Promise<AutoAcceptedBooking | null> {
  await delay(800);
  if (availableSeats <= 0) {
    console.log('[MockData] No seats available for auto-accept');
    return null;
  }
  const p = autoAcceptPassengers[autoAcceptIdx % autoAcceptPassengers.length];
  autoAcceptIdx++;
  const booking: AutoAcceptedBooking = {
    id: 'auto_' + Date.now() + '_' + autoAcceptIdx,
    passenger_name: p.name,
    pickup_stop: p.pickup,
    destination_stop: p.dest,
    seats_taken: 1,
    auto_accepted_at: new Date().toISOString(),
  };
  console.log('[MockData] Auto-accepted booking:', booking.passenger_name);
  return booking;
}

export async function mockUpdateDrivingStatus(status: string): Promise<void> {
  await delay(300);
  console.log('[MockData] Driving status updated to:', status);
}

export async function mockUpdateSeatCount(available: number, total: number): Promise<{ available: number; total: number }> {
  await delay(300);
  mockSystemSeats = { available, total };
  console.log('[MockData] Seat count updated — available:', available, 'total:', total);
  return { available, total };
}

let mockSystemSeats = { available: 8, total: 14 };
let mockSeatEvents: SeatEvent[] = [];
let systemEventCounter = 0;

function generateSystemSeatEvent(): SeatEvent | null {
  const rand = Math.random();
  if (rand < 0.35) return null;

  const isBoarding = rand < 0.7;
  const names = ['Nana Akoto', 'Adjoa Baah', 'Kofi Tetteh', 'Ama Darko', 'Kwaku Mensah', 'Akosua Poku'];
  systemEventCounter++;

  if (isBoarding && mockSystemSeats.available > 0) {
    mockSystemSeats.available = Math.max(0, mockSystemSeats.available - 1);
    const evt: SeatEvent = {
      id: 'sevt_' + Date.now() + '_' + systemEventCounter,
      type: 'BOARDING',
      seats_changed: -1,
      passenger_name: names[Math.floor(Math.random() * names.length)],
      timestamp: new Date().toISOString(),
      source: 'SYSTEM',
    };
    mockSeatEvents.unshift(evt);
    if (mockSeatEvents.length > 10) mockSeatEvents = mockSeatEvents.slice(0, 10);
    return evt;
  } else if (!isBoarding && mockSystemSeats.available < mockSystemSeats.total) {
    mockSystemSeats.available = Math.min(mockSystemSeats.total, mockSystemSeats.available + 1);
    const evt: SeatEvent = {
      id: 'sevt_' + Date.now() + '_' + systemEventCounter,
      type: 'ALIGHTING',
      seats_changed: 1,
      passenger_name: names[Math.floor(Math.random() * names.length)],
      timestamp: new Date().toISOString(),
      source: 'SYSTEM',
    };
    mockSeatEvents.unshift(evt);
    if (mockSeatEvents.length > 10) mockSeatEvents = mockSeatEvents.slice(0, 10);
    return evt;
  }
  return null;
}

export async function mockFetchSeatSync(): Promise<SeatSyncData> {
  await delay(400);
  const newEvent = generateSystemSeatEvent();
  console.log('[MockData] Seat sync — available:', mockSystemSeats.available, '/', mockSystemSeats.total, newEvent ? `(${newEvent.type})` : '(no change)');
  return {
    available_seats: mockSystemSeats.available,
    total_seats: mockSystemSeats.total,
    last_updated: new Date().toISOString(),
    recent_events: mockSeatEvents.slice(0, 5),
    has_system_update: newEvent !== null,
  };
}

const mockAvailableRoutes: AvailableRoute[] = [
  { id: 'r1', name: 'Circle → Kumasi Central', origin: 'Circle', destination: 'Kumasi Central', distance_km: 12.5, estimated_duration_min: 45, demand_level: 'HIGH' },
  { id: 'r2', name: 'Kaneshie → Madina', origin: 'Kaneshie', destination: 'Madina', distance_km: 18.2, estimated_duration_min: 60, demand_level: 'MEDIUM' },
  { id: 'r3', name: 'Achimota → Tema Station', origin: 'Achimota', destination: 'Tema Station', distance_km: 22.0, estimated_duration_min: 55, demand_level: 'HIGH' },
  { id: 'r4', name: 'Odorkor → Legon', origin: 'Odorkor', destination: 'Legon', distance_km: 15.8, estimated_duration_min: 50, demand_level: 'LOW' },
  { id: 'r5', name: 'Lapaz → Kasoa', origin: 'Lapaz', destination: 'Kasoa', distance_km: 20.5, estimated_duration_min: 65, demand_level: 'MEDIUM' },
  { id: 'r6', name: 'Nungua → Accra Central', origin: 'Nungua', destination: 'Accra Central', distance_km: 14.0, estimated_duration_min: 40, demand_level: 'LOW' },
  { id: 'r7', name: 'Spintex → Airport', origin: 'Spintex', destination: 'Airport', distance_km: 8.5, estimated_duration_min: 25, demand_level: 'HIGH' },
];

let currentAssignedRoute: Route = { id: 'r1', name: 'Circle → Kumasi Central', origin: 'Circle', destination: 'Kumasi Central' };

export async function mockGetAvailableRoutes(): Promise<AvailableRoute[]> {
  await delay(MOCK_DELAY);
  return mockAvailableRoutes.filter((r) => r.id !== currentAssignedRoute.id);
}

export async function mockCheckRouteChangeEligibility(): Promise<RouteChangeEligibility> {
  await delay(400);
  return { canChange: true, reasons: [] };
}

export async function mockChangeRoute(routeId: string): Promise<Route> {
  await delay(1000);
  const route = mockAvailableRoutes.find((r) => r.id === routeId);
  if (!route) throw new Error('Route not found');
  currentAssignedRoute = { id: route.id, name: route.name, origin: route.origin, destination: route.destination };
  console.log('[MockData] Route changed to:', route.name);
  return currentAssignedRoute;
}

export async function mockReportPassengerEvent(type: 'BOARDING' | 'ALIGHTING', passengerName?: string): Promise<SeatEvent> {
  await delay(300);
  systemEventCounter++;
  const seatsChanged = type === 'BOARDING' ? -1 : 1;
  if (type === 'BOARDING') {
    mockSystemSeats.available = Math.max(0, mockSystemSeats.available - 1);
  } else {
    mockSystemSeats.available = Math.min(mockSystemSeats.total, mockSystemSeats.available + 1);
  }
  const evt: SeatEvent = {
    id: 'pevt_' + Date.now() + '_' + systemEventCounter,
    type,
    seats_changed: seatsChanged,
    passenger_name: passengerName,
    timestamp: new Date().toISOString(),
    source: 'SYSTEM',
  };
  mockSeatEvents.unshift(evt);
  if (mockSeatEvents.length > 10) mockSeatEvents = mockSeatEvents.slice(0, 10);
  console.log('[MockData] Passenger event reported:', type, passengerName);
  return evt;
}
