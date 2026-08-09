export type RoutingProfile = 'walking' | 'driving' | 'driving-traffic';

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type RouteStep = {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  maneuverType: string | null;
  modifier: string | null;
  location: [number, number] | null;
};

export type RouteDirections = {
  provider: 'mapbox';
  profile: RoutingProfile;
  distanceMeters: number;
  durationSeconds: number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  steps: RouteStep[];
  generatedAt: string;
};

export type DirectionsRequest = {
  origin: MapCoordinate;
  destination: MapCoordinate;
  profile?: RoutingProfile;
  steps?: boolean;
  signal?: AbortSignal;
};
