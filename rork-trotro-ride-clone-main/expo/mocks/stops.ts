import { BusStop } from '@/types';

export const ACCRA_BUS_STOPS: BusStop[] = [
  { id: 'stop-circle', name: 'Circle', type: 'station', lat: 5.5700, lng: -0.2100, status: 'active' },
  { id: 'stop-kaneshie', name: 'Kaneshie', type: 'station', lat: 5.5567, lng: -0.2367, status: 'active' },
  { id: 'stop-lapaz', name: 'Lapaz', type: 'stop', lat: 5.6000, lng: -0.2433, status: 'active' },
  { id: 'stop-achimota', name: 'Achimota', type: 'station', lat: 5.6167, lng: -0.2333, status: 'active' },
  { id: 'stop-37', name: '37 Military Hospital', type: 'stop', lat: 5.5833, lng: -0.1833, status: 'active' },
  { id: 'stop-madina', name: 'Madina', type: 'station', lat: 5.6633, lng: -0.1717, status: 'active' },
  { id: 'stop-tema-station', name: 'Tema Station', type: 'station', lat: 5.5483, lng: -0.2050, status: 'active' },
  { id: 'stop-legon', name: 'Legon', type: 'stop', lat: 5.6500, lng: -0.1867, status: 'active' },
  { id: 'stop-accra-mall', name: 'Accra Mall', type: 'stop', lat: 5.5750, lng: -0.1750, status: 'active' },
  { id: 'stop-osu', name: 'Osu', type: 'stop', lat: 5.5567, lng: -0.1817, status: 'active' },
];

export const KUMASI_BUS_STOPS: BusStop[] = [
  { id: 'stop-kejetia', name: 'Kejetia', type: 'station', lat: 6.6885, lng: -1.6244, status: 'active' },
  { id: 'stop-adum', name: 'Adum', type: 'station', lat: 6.6900, lng: -1.6200, status: 'active' },
  { id: 'stop-bantama', name: 'Bantama', type: 'stop', lat: 6.7000, lng: -1.6350, status: 'active' },
  { id: 'stop-suame', name: 'Suame', type: 'station', lat: 6.7100, lng: -1.6300, status: 'active' },
  { id: 'stop-asafo', name: 'Asafo', type: 'station', lat: 6.6800, lng: -1.6100, status: 'active' },
  { id: 'stop-knust', name: 'KNUST', type: 'stop', lat: 6.6745, lng: -1.5716, status: 'active' },
  { id: 'stop-tafo', name: 'Tafo', type: 'stop', lat: 6.7200, lng: -1.6100, status: 'active' },
  { id: 'stop-manhyia', name: 'Manhyia', type: 'stop', lat: 6.7050, lng: -1.6150, status: 'active' },
];

export const TAMALE_BUS_STOPS: BusStop[] = [
  { id: 'stop-tamale-central', name: 'Tamale Central', type: 'station', lat: 9.4034, lng: -0.8424, status: 'active' },
  { id: 'stop-lamashegu', name: 'Lamashegu', type: 'stop', lat: 9.4100, lng: -0.8500, status: 'active' },
  { id: 'stop-nyohini', name: 'Nyohini', type: 'stop', lat: 9.3900, lng: -0.8350, status: 'active' },
  { id: 'stop-kalpohin', name: 'Kalpohin', type: 'stop', lat: 9.4200, lng: -0.8300, status: 'active' },
  { id: 'stop-uds-tamale', name: 'UDS Tamale', type: 'stop', lat: 9.3800, lng: -0.8450, status: 'active' },
  { id: 'stop-hospital-road', name: 'Hospital Road', type: 'stop', lat: 9.4050, lng: -0.8380, status: 'active' },
];

export const CAPE_COAST_BUS_STOPS: BusStop[] = [
  { id: 'stop-cape-coast-station', name: 'Cape Coast Station', type: 'station', lat: 5.1036, lng: -1.2466, status: 'active' },
  { id: 'stop-ucc', name: 'UCC', type: 'stop', lat: 5.1150, lng: -1.2900, status: 'active' },
  { id: 'stop-abura', name: 'Abura', type: 'stop', lat: 5.1100, lng: -1.2600, status: 'active' },
  { id: 'stop-pedu', name: 'Pedu', type: 'stop', lat: 5.1200, lng: -1.2700, status: 'active' },
  { id: 'stop-castle', name: 'Cape Coast Castle', type: 'stop', lat: 5.1050, lng: -1.2400, status: 'active' },
];

export const TAKORADI_BUS_STOPS: BusStop[] = [
  { id: 'stop-takoradi-market', name: 'Takoradi Market Circle', type: 'station', lat: 4.8894, lng: -1.7554, status: 'active' },
  { id: 'stop-harbour', name: 'Harbour Area', type: 'stop', lat: 4.8850, lng: -1.7600, status: 'active' },
  { id: 'stop-effia', name: 'Effia', type: 'stop', lat: 4.9000, lng: -1.7650, status: 'active' },
  { id: 'stop-kojokrom', name: 'Kojokrom', type: 'stop', lat: 4.9100, lng: -1.7500, status: 'active' },
  { id: 'stop-sekondi', name: 'Sekondi', type: 'station', lat: 4.9300, lng: -1.7100, status: 'active' },
];

export interface RegionData {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  stops: BusStop[];
}

export const ALL_REGIONS: RegionData[] = [
  { id: 'accra', name: 'Accra, Greater Accra', centerLat: 5.5900, centerLng: -0.2050, stops: ACCRA_BUS_STOPS },
  { id: 'kumasi', name: 'Kumasi, Ashanti Region', centerLat: 6.6885, centerLng: -1.6244, stops: KUMASI_BUS_STOPS },
  { id: 'tamale', name: 'Tamale, Northern Region', centerLat: 9.4034, centerLng: -0.8424, stops: TAMALE_BUS_STOPS },
  { id: 'cape-coast', name: 'Cape Coast, Central Region', centerLat: 5.1036, centerLng: -1.2466, stops: CAPE_COAST_BUS_STOPS },
  { id: 'takoradi', name: 'Takoradi, Western Region', centerLat: 4.8894, centerLng: -1.7554, stops: TAKORADI_BUS_STOPS },
];

export const ALL_BUS_STOPS: BusStop[] = [
  ...ACCRA_BUS_STOPS,
  ...KUMASI_BUS_STOPS,
  ...TAMALE_BUS_STOPS,
  ...CAPE_COAST_BUS_STOPS,
  ...TAKORADI_BUS_STOPS,
];

export const getStopById = (id: string): BusStop | undefined =>
  ALL_BUS_STOPS.find((s) => s.id === id);

export const getStopName = (id: string): string =>
  getStopById(id)?.name ?? 'Unknown Stop';
