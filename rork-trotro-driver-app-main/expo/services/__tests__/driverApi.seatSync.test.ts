jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('@/store/driverStore', () => ({
  useDriverStore: { getState: jest.fn() },
}));

import api from '../api';
import { fetchSeatSync } from '../driverApi';

const mockGet = api.get as jest.MockedFunction<typeof api.get>;

describe('driver seat synchronization', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('reads authoritative capacity from the driver dashboard', async () => {
    mockGet.mockResolvedValue({
      data: {
        available_seats: 7,
        total_seats: 14,
        driver_name: 'Test Driver',
      },
    });

    await expect(fetchSeatSync()).resolves.toMatchObject({
      available_seats: 7,
      total_seats: 14,
      recent_events: [],
      has_system_update: true,
    });
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/drivers/me/dashboard');
  });

  it('preserves legitimate zero-seat capacity', async () => {
    mockGet.mockResolvedValue({
      data: { available_seats: 0, total_seats: 18 },
    });

    await expect(fetchSeatSync()).resolves.toMatchObject({
      available_seats: 0,
      total_seats: 18,
    });
  });
});
