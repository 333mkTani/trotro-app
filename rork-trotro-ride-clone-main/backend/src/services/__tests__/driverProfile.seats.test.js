jest.mock('../../config/db', () => ({ query: jest.fn() }));
jest.mock('../../models/bus.model');
jest.mock('../../models/wallet.model');
jest.mock('../../realtime/io', () => ({ emitToBus: jest.fn(), emitToRoute: jest.fn() }));

const { query } = require('../../config/db');
const service = require('../driverProfile.service');

describe('driver profile seat updates', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects available capacity above the bus total', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'bus-1', seats_available: 14, total_seats: 14 }] });
    await expect(service.updateSeats('driver-1', { availableSeats: 15, totalSeats: 14 }))
      .rejects.toThrow('between 0 and total seats');
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('accepts the upper boundary without exceeding it', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'bus-1', seats_available: 13, total_seats: 14 }] })
      .mockResolvedValueOnce({ rows: [{ id: 'bus-1', seats_available: 14, total_seats: 14 }] });
    await expect(service.updateSeats('driver-1', { availableSeats: 14, totalSeats: 14 }))
      .resolves.toMatchObject({ seats_available: 14, total_seats: 14 });
  });
});
