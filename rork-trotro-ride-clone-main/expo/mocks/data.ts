import { User, Booking, ApproachingBus, DemandStop, VerificationCode, SchedulingRules } from '@/types';

export const MOCK_PASSENGERS: User[] = [
  { id: 'pass-1', phone: '+233240000001', full_name: 'Kwame Asante', role: 'passenger', created_at: '2025-01-15T08:00:00Z' },
  { id: 'pass-2', phone: '+233240000002', full_name: 'Ama Mensah', role: 'passenger', created_at: '2025-01-16T09:00:00Z' },
  { id: 'pass-3', phone: '+233240000003', full_name: 'Kofi Adjei', role: 'passenger', created_at: '2025-02-01T10:00:00Z' },
  { id: 'pass-4', phone: '+233240000004', full_name: 'Efua Boateng', role: 'passenger', created_at: '2025-02-10T07:00:00Z' },
  { id: 'pass-5', phone: '+233240000005', full_name: 'Yaw Owusu', role: 'passenger', created_at: '2025-03-01T06:00:00Z' },
];

export const MOCK_APPROACHING_BUSES: Record<string, ApproachingBus[]> = {
  'stop-circle': [
    { driver_id: 'driver-1', bus_registration: 'GR-1234-20', driver_name: 'Nana Akufo', seats_available: 8, eta_minutes: 4, route_name: 'Circle - Madina', lat: 5.5750, lng: -0.2050 },
    { driver_id: 'driver-2', bus_registration: 'GR-5678-21', driver_name: 'Francis Tetteh', seats_available: 3, eta_minutes: 12, route_name: 'Kaneshie - Achimota', lat: 5.5600, lng: -0.2300 },
  ],
  'stop-kaneshie': [
    { driver_id: 'driver-2', bus_registration: 'GR-5678-21', driver_name: 'Francis Tetteh', seats_available: 3, eta_minutes: 7, route_name: 'Kaneshie - Achimota', lat: 5.5600, lng: -0.2300 },
  ],
  'stop-37': [
    { driver_id: 'driver-1', bus_registration: 'GR-1234-20', driver_name: 'Nana Akufo', seats_available: 8, eta_minutes: 15, route_name: 'Circle - Madina', lat: 5.5750, lng: -0.2050 },
  ],
  'stop-tema-station': [
    { driver_id: 'driver-3', bus_registration: 'GR-9012-22', driver_name: 'Emmanuel Osei', seats_available: 11, eta_minutes: 3, route_name: 'Tema Station - Accra Mall', lat: 5.5520, lng: -0.2000 },
  ],
  'stop-osu': [
    { driver_id: 'driver-3', bus_registration: 'GR-9012-22', driver_name: 'Emmanuel Osei', seats_available: 11, eta_minutes: 10, route_name: 'Tema Station - Accra Mall', lat: 5.5520, lng: -0.2000 },
  ],
  'stop-madina': [],
  'stop-lapaz': [
    { driver_id: 'driver-2', bus_registration: 'GR-5678-21', driver_name: 'Francis Tetteh', seats_available: 3, eta_minutes: 20, route_name: 'Kaneshie - Achimota', lat: 5.5600, lng: -0.2300 },
  ],
  'stop-achimota': [],
  'stop-legon': [
    { driver_id: 'driver-1', bus_registration: 'GR-1234-20', driver_name: 'Nana Akufo', seats_available: 8, eta_minutes: 22, route_name: 'Circle - Madina', lat: 5.5750, lng: -0.2050 },
  ],
  'stop-accra-mall': [
    { driver_id: 'driver-3', bus_registration: 'GR-9012-22', driver_name: 'Emmanuel Osei', seats_available: 11, eta_minutes: 14, route_name: 'Tema Station - Accra Mall', lat: 5.5520, lng: -0.2000 },
  ],

  'stop-kejetia': [
    { driver_id: 'driver-k1', bus_registration: 'AS-2001-22', driver_name: 'Yaw Boakye', seats_available: 10, eta_minutes: 3, route_name: 'Kejetia - KNUST', lat: 6.6900, lng: -1.6200 },
    { driver_id: 'driver-k2', bus_registration: 'AS-2002-23', driver_name: 'Kwesi Appiah', seats_available: 5, eta_minutes: 8, route_name: 'Kejetia - Suame', lat: 6.6950, lng: -1.6280 },
  ],
  'stop-adum': [
    { driver_id: 'driver-k1', bus_registration: 'AS-2001-22', driver_name: 'Yaw Boakye', seats_available: 10, eta_minutes: 7, route_name: 'Kejetia - KNUST', lat: 6.6900, lng: -1.6200 },
  ],
  'stop-bantama': [
    { driver_id: 'driver-k2', bus_registration: 'AS-2002-23', driver_name: 'Kwesi Appiah', seats_available: 5, eta_minutes: 12, route_name: 'Kejetia - Suame', lat: 6.6950, lng: -1.6280 },
  ],
  'stop-suame': [],
  'stop-asafo': [
    { driver_id: 'driver-k3', bus_registration: 'AS-2003-23', driver_name: 'Kofi Darko', seats_available: 7, eta_minutes: 5, route_name: 'Asafo - Tafo', lat: 6.6820, lng: -1.6120 },
  ],
  'stop-knust': [
    { driver_id: 'driver-k1', bus_registration: 'AS-2001-22', driver_name: 'Yaw Boakye', seats_available: 10, eta_minutes: 18, route_name: 'Kejetia - KNUST', lat: 6.6900, lng: -1.6200 },
  ],
  'stop-tafo': [],
  'stop-manhyia': [
    { driver_id: 'driver-k2', bus_registration: 'AS-2002-23', driver_name: 'Kwesi Appiah', seats_available: 5, eta_minutes: 15, route_name: 'Kejetia - Suame', lat: 6.6950, lng: -1.6280 },
  ],

  'stop-tamale-central': [
    { driver_id: 'driver-t1', bus_registration: 'NR-3001-22', driver_name: 'Ibrahim Mahama', seats_available: 12, eta_minutes: 5, route_name: 'Central - Kalpohin', lat: 9.4050, lng: -0.8440 },
    { driver_id: 'driver-t2', bus_registration: 'NR-3002-23', driver_name: 'Alhassan Sulemana', seats_available: 6, eta_minutes: 9, route_name: 'Central - UDS', lat: 9.4020, lng: -0.8410 },
  ],
  'stop-lamashegu': [
    { driver_id: 'driver-t1', bus_registration: 'NR-3001-22', driver_name: 'Ibrahim Mahama', seats_available: 12, eta_minutes: 10, route_name: 'Central - Kalpohin', lat: 9.4050, lng: -0.8440 },
  ],
  'stop-nyohini': [
    { driver_id: 'driver-t2', bus_registration: 'NR-3002-23', driver_name: 'Alhassan Sulemana', seats_available: 6, eta_minutes: 14, route_name: 'Central - UDS', lat: 9.4020, lng: -0.8410 },
  ],
  'stop-kalpohin': [],
  'stop-uds-tamale': [],
  'stop-hospital-road': [
    { driver_id: 'driver-t2', bus_registration: 'NR-3002-23', driver_name: 'Alhassan Sulemana', seats_available: 6, eta_minutes: 7, route_name: 'Central - UDS', lat: 9.4020, lng: -0.8410 },
  ],

  'stop-cape-coast-station': [
    { driver_id: 'driver-cc1', bus_registration: 'CR-4001-22', driver_name: 'Samuel Mensah', seats_available: 9, eta_minutes: 4, route_name: 'Station - UCC', lat: 5.1050, lng: -1.2480 },
    { driver_id: 'driver-cc2', bus_registration: 'CR-4002-23', driver_name: 'Philip Aidoo', seats_available: 8, eta_minutes: 6, route_name: 'Station - Castle', lat: 5.1040, lng: -1.2450 },
  ],
  'stop-ucc': [],
  'stop-abura': [
    { driver_id: 'driver-cc1', bus_registration: 'CR-4001-22', driver_name: 'Samuel Mensah', seats_available: 9, eta_minutes: 10, route_name: 'Station - UCC', lat: 5.1050, lng: -1.2480 },
  ],
  'stop-pedu': [
    { driver_id: 'driver-cc1', bus_registration: 'CR-4001-22', driver_name: 'Samuel Mensah', seats_available: 9, eta_minutes: 13, route_name: 'Station - UCC', lat: 5.1050, lng: -1.2480 },
  ],
  'stop-castle': [
    { driver_id: 'driver-cc2', bus_registration: 'CR-4002-23', driver_name: 'Philip Aidoo', seats_available: 8, eta_minutes: 8, route_name: 'Station - Castle', lat: 5.1040, lng: -1.2450 },
  ],

  'stop-takoradi-market': [
    { driver_id: 'driver-tk1', bus_registration: 'WR-5001-22', driver_name: 'Joseph Ackah', seats_available: 7, eta_minutes: 3, route_name: 'Market - Sekondi', lat: 4.8900, lng: -1.7560 },
    { driver_id: 'driver-tk2', bus_registration: 'WR-5002-23', driver_name: 'Daniel Quayson', seats_available: 10, eta_minutes: 7, route_name: 'Market - Effia', lat: 4.8880, lng: -1.7580 },
  ],
  'stop-harbour': [
    { driver_id: 'driver-tk1', bus_registration: 'WR-5001-22', driver_name: 'Joseph Ackah', seats_available: 7, eta_minutes: 8, route_name: 'Market - Sekondi', lat: 4.8900, lng: -1.7560 },
  ],
  'stop-effia': [
    { driver_id: 'driver-tk2', bus_registration: 'WR-5002-23', driver_name: 'Daniel Quayson', seats_available: 10, eta_minutes: 12, route_name: 'Market - Effia', lat: 4.8880, lng: -1.7580 },
  ],
  'stop-kojokrom': [
    { driver_id: 'driver-tk1', bus_registration: 'WR-5001-22', driver_name: 'Joseph Ackah', seats_available: 7, eta_minutes: 15, route_name: 'Market - Sekondi', lat: 4.8900, lng: -1.7560 },
  ],
  'stop-sekondi': [],
};

const now = new Date();
const tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(6, 30, 0, 0);

const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);
yesterday.setHours(7, 0, 0, 0);

export const MOCK_BOOKINGS: Booking[] = [
  {
    id: 'booking-1', passenger_id: 'pass-1', driver_id: 'driver-1',
    driver_name: 'Nana Akufo', bus_registration: 'GR-1234-20',
    pickup_stop_id: 'stop-circle', pickup_stop_name: 'Circle',
    destination_stop_id: 'stop-madina', destination_stop_name: 'Madina',
    desired_arrival_time: tomorrow.toISOString(), buffer_minutes: 10,
    status: 'confirmed', confirmed_at: now.toISOString(),
    created_at: now.toISOString(), route_name: 'Circle - Madina',
    ride_fare: 5.00,
  },
  {
    id: 'booking-2', passenger_id: 'pass-1',
    pickup_stop_id: 'stop-kaneshie', pickup_stop_name: 'Kaneshie',
    destination_stop_id: 'stop-achimota', destination_stop_name: 'Achimota',
    desired_arrival_time: tomorrow.toISOString(), buffer_minutes: 15,
    status: 'pending',
    created_at: now.toISOString(), route_name: 'Kaneshie - Achimota',
    ride_fare: 3.50,
  },
  {
    id: 'booking-3', passenger_id: 'pass-1', driver_id: 'driver-3',
    driver_name: 'Emmanuel Osei', bus_registration: 'GR-9012-22',
    pickup_stop_id: 'stop-tema-station', pickup_stop_name: 'Tema Station',
    destination_stop_id: 'stop-accra-mall', destination_stop_name: 'Accra Mall',
    desired_arrival_time: yesterday.toISOString(), buffer_minutes: 10,
    status: 'completed', completed_at: yesterday.toISOString(),
    created_at: yesterday.toISOString(), route_name: 'Tema Station - Accra Mall',
    ride_fare: 2.50,
  },
  {
    id: 'booking-4', passenger_id: 'pass-2', driver_id: 'driver-1',
    driver_name: 'Nana Akufo', bus_registration: 'GR-1234-20',
    pickup_stop_id: 'stop-37', pickup_stop_name: '37 Military Hospital',
    destination_stop_id: 'stop-legon', destination_stop_name: 'Legon',
    desired_arrival_time: tomorrow.toISOString(), buffer_minutes: 20,
    status: 'confirmed', confirmed_at: now.toISOString(),
    created_at: now.toISOString(), route_name: 'Circle - Madina',
    ride_fare: 5.00,
  },
  {
    id: 'booking-5', passenger_id: 'pass-3',
    pickup_stop_id: 'stop-osu', pickup_stop_name: 'Osu',
    destination_stop_id: 'stop-accra-mall', destination_stop_name: 'Accra Mall',
    desired_arrival_time: tomorrow.toISOString(), buffer_minutes: 10,
    status: 'pending',
    created_at: now.toISOString(), route_name: 'Tema Station - Accra Mall',
    ride_fare: 2.50,
  },
];

export const MOCK_VERIFICATION_CODES: VerificationCode[] = [
  {
    code: 'HK7M3R', booking_id: 'booking-1',
    valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'valid', passenger_name: 'Kwame Asante',
    route_name: 'Circle - Madina', pickup_stop: 'Circle', destination_stop: 'Madina',
  },
  {
    code: 'WT9N5P', booking_id: 'booking-4',
    valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: 'valid', passenger_name: 'Ama Mensah',
    route_name: 'Circle - Madina', pickup_stop: '37 Military Hospital', destination_stop: 'Legon',
  },
];

export const MOCK_DEMAND: DemandStop[] = [
  { stop_id: 'stop-circle', stop_name: 'Circle', lat: 5.5700, lng: -0.2100, demand_count: 8 },
  { stop_id: 'stop-kaneshie', stop_name: 'Kaneshie', lat: 5.5567, lng: -0.2367, demand_count: 5 },
  { stop_id: 'stop-madina', stop_name: 'Madina', lat: 5.6633, lng: -0.1717, demand_count: 6 },
  { stop_id: 'stop-tema-station', stop_name: 'Tema Station', lat: 5.5483, lng: -0.2050, demand_count: 3 },
  { stop_id: 'stop-37', stop_name: '37 Military Hospital', lat: 5.5833, lng: -0.1833, demand_count: 2 },
  { stop_id: 'stop-osu', stop_name: 'Osu', lat: 5.5567, lng: -0.1817, demand_count: 4 },
  { stop_id: 'stop-lapaz', stop_name: 'Lapaz', lat: 5.6000, lng: -0.2433, demand_count: 1 },
  { stop_id: 'stop-legon', stop_name: 'Legon', lat: 5.6500, lng: -0.1867, demand_count: 3 },
  { stop_id: 'stop-achimota', stop_name: 'Achimota', lat: 5.6167, lng: -0.2333, demand_count: 2 },
  { stop_id: 'stop-accra-mall', stop_name: 'Accra Mall', lat: 5.5750, lng: -0.1750, demand_count: 4 },
];

export const MOCK_SCHEDULING_RULES: SchedulingRules = {
  booking_window_start: '03:00',
  booking_window_end: '08:00',
  min_advance_minutes: 45,
  notification_trigger_km: 2.0,
  allowed_buffer_options: [10, 15, 20],
};
