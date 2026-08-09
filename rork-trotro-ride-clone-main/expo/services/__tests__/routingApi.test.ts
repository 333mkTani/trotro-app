jest.mock('../api', () => ({
  api: { get: jest.fn() },
}));

import { api } from '../api';
import { getDirections } from '../routingApi';

const mockedGet = api.get as jest.MockedFunction<typeof api.get>;

describe('passenger routing API', () => {
  it('sends coordinate fields to the authenticated routing endpoint', async () => {
    const route = {
      provider: 'mapbox' as const,
      profile: 'walking' as const,
      distanceMeters: 950,
      durationSeconds: 720,
      geometry: { type: 'LineString' as const, coordinates: [[-0.2, 5.6], [-0.1, 5.7]] as [number, number][] },
      steps: [],
      generatedAt: '2026-08-09T18:00:00.000Z',
    };
    mockedGet.mockResolvedValue({ data: route });
    const controller = new AbortController();

    await expect(getDirections({
      origin: { latitude: 5.6, longitude: -0.2 },
      destination: { latitude: 5.7, longitude: -0.1 },
      profile: 'walking',
      steps: false,
      signal: controller.signal,
    })).resolves.toEqual(route);

    expect(mockedGet).toHaveBeenCalledWith('/routing/directions', {
      params: {
        originLat: 5.6,
        originLng: -0.2,
        destinationLat: 5.7,
        destinationLng: -0.1,
        profile: 'walking',
        steps: false,
      },
      signal: controller.signal,
    });
  });
});
