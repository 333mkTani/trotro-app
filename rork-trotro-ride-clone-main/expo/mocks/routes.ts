import { Route } from '@/types';

export const ACCRA_ROUTES: Route[] = [
  {
    id: 'route-1',
    name: 'Circle - Madina',
    origin: 'Circle',
    destination: 'Madina',
    stops_sequence: ['stop-circle', 'stop-37', 'stop-legon', 'stop-madina'],
    distance_km: 12.5,
    duration_min: 35,
    fare: 5.00,
    status: 'active',
  },
  {
    id: 'route-2',
    name: 'Kaneshie - Achimota',
    origin: 'Kaneshie',
    destination: 'Achimota',
    stops_sequence: ['stop-kaneshie', 'stop-circle', 'stop-lapaz', 'stop-achimota'],
    distance_km: 9.8,
    duration_min: 28,
    fare: 3.50,
    status: 'active',
  },
  {
    id: 'route-3',
    name: 'Tema Station - Accra Mall',
    origin: 'Tema Station',
    destination: 'Accra Mall',
    stops_sequence: ['stop-tema-station', 'stop-osu', 'stop-accra-mall'],
    distance_km: 6.2,
    duration_min: 18,
    fare: 2.50,
    status: 'active',
  },
];

export const KUMASI_ROUTES: Route[] = [
  {
    id: 'route-k1',
    name: 'Kejetia - KNUST',
    origin: 'Kejetia',
    destination: 'KNUST',
    stops_sequence: ['stop-kejetia', 'stop-adum', 'stop-asafo', 'stop-knust'],
    distance_km: 8.5,
    duration_min: 25,
    fare: 4.00,
    status: 'active',
  },
  {
    id: 'route-k2',
    name: 'Kejetia - Suame',
    origin: 'Kejetia',
    destination: 'Suame',
    stops_sequence: ['stop-kejetia', 'stop-bantama', 'stop-manhyia', 'stop-suame'],
    distance_km: 5.2,
    duration_min: 18,
    fare: 3.00,
    status: 'active',
  },
  {
    id: 'route-k3',
    name: 'Asafo - Tafo',
    origin: 'Asafo',
    destination: 'Tafo',
    stops_sequence: ['stop-asafo', 'stop-manhyia', 'stop-tafo'],
    distance_km: 6.0,
    duration_min: 20,
    fare: 3.50,
    status: 'active',
  },
];

export const TAMALE_ROUTES: Route[] = [
  {
    id: 'route-t1',
    name: 'Central - Kalpohin',
    origin: 'Tamale Central',
    destination: 'Kalpohin',
    stops_sequence: ['stop-tamale-central', 'stop-lamashegu', 'stop-kalpohin'],
    distance_km: 4.5,
    duration_min: 15,
    fare: 2.00,
    status: 'active',
  },
  {
    id: 'route-t2',
    name: 'Central - UDS',
    origin: 'Tamale Central',
    destination: 'UDS Tamale',
    stops_sequence: ['stop-tamale-central', 'stop-hospital-road', 'stop-nyohini', 'stop-uds-tamale'],
    distance_km: 5.8,
    duration_min: 18,
    fare: 2.50,
    status: 'active',
  },
];

export const CAPE_COAST_ROUTES: Route[] = [
  {
    id: 'route-cc1',
    name: 'Station - UCC',
    origin: 'Cape Coast Station',
    destination: 'UCC',
    stops_sequence: ['stop-cape-coast-station', 'stop-abura', 'stop-pedu', 'stop-ucc'],
    distance_km: 5.0,
    duration_min: 16,
    fare: 2.50,
    status: 'active',
  },
  {
    id: 'route-cc2',
    name: 'Station - Castle',
    origin: 'Cape Coast Station',
    destination: 'Cape Coast Castle',
    stops_sequence: ['stop-cape-coast-station', 'stop-castle'],
    distance_km: 1.5,
    duration_min: 8,
    fare: 1.50,
    status: 'active',
  },
];

export const TAKORADI_ROUTES: Route[] = [
  {
    id: 'route-tk1',
    name: 'Market - Sekondi',
    origin: 'Takoradi Market Circle',
    destination: 'Sekondi',
    stops_sequence: ['stop-takoradi-market', 'stop-harbour', 'stop-kojokrom', 'stop-sekondi'],
    distance_km: 7.0,
    duration_min: 22,
    fare: 3.00,
    status: 'active',
  },
  {
    id: 'route-tk2',
    name: 'Market - Effia',
    origin: 'Takoradi Market Circle',
    destination: 'Effia',
    stops_sequence: ['stop-takoradi-market', 'stop-harbour', 'stop-effia'],
    distance_km: 3.5,
    duration_min: 12,
    fare: 2.00,
    status: 'active',
  },
];

export const ALL_ROUTES: Route[] = [
  ...ACCRA_ROUTES,
  ...KUMASI_ROUTES,
  ...TAMALE_ROUTES,
  ...CAPE_COAST_ROUTES,
  ...TAKORADI_ROUTES,
];

export const REGION_ROUTES: Record<string, Route[]> = {
  'accra': ACCRA_ROUTES,
  'kumasi': KUMASI_ROUTES,
  'tamale': TAMALE_ROUTES,
  'cape-coast': CAPE_COAST_ROUTES,
  'takoradi': TAKORADI_ROUTES,
};

export const getRouteById = (id: string): Route | undefined =>
  ALL_ROUTES.find((r) => r.id === id);
