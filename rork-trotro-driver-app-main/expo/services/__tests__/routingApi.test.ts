jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

import api from '../api';
import { getDirections } from '../routingApi';

const mockedGet = api.get as jest.MockedFunction<typeof api.get>;

describe('driver routing API', () => {
  it('defaults vehicle navigation to driving with steps enabled', async () => {
    const route = {
      provider: 'mapbox' as const,
      profile: 'driving' as const,
      distanceMeters: 3200,
      durationSeconds: 600,
      geometry: { type: 'LineString' as const, coordinates: [[-0.2, 5.6], [-0.1, 5.7]] as [number, number][] },
      steps: [],
      generatedAt: '2026-08-09T18:00:00.000Z',
    };
    mockedGet.mockResolvedValue({ data: route });

    await expect(getDirections({
      origin: { latitude: 5.6, longitude: -0.2 },
      destination: { latitude: 5.7, longitude: -0.1 },
    })).resolves.toEqual(route);

    expect(mockedGet).toHaveBeenCalledWith('/routing/directions', {
      params: {
        originLat: 5.6,
        originLng: -0.2,
        destinationLat: 5.7,
        destinationLng: -0.1,
        profile: 'driving',
        steps: true,
      },
      signal: undefined,
    });
  });
});
