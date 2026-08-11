jest.mock('../../config/db', () => ({ query: jest.fn() }));
jest.mock('../../models/bus.model');
jest.mock('../../models/booking.model');
jest.mock('../../models/wallet.model');
jest.mock('../push.service', () => ({ send: jest.fn() }));
jest.mock('../../realtime/io', () => ({
  emitToBus: jest.fn(),
  emitToRoute: jest.fn(),
  emitToUser: jest.fn(),
}));

const { query } = require('../../config/db');
const busModel = require('../../models/bus.model');
const bookingModel = require('../../models/booking.model');
const { emitToUser } = require('../../realtime/io');
const service = require('../driverProfile.service');

describe('driver profile location lifecycle', () => {
  beforeEach(() => jest.clearAllMocks());

  it('detects and emits destination arrival from the endpoint used by the driver app', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'bus-1', driver_id: 'driver-1', route_id: 'route-1', status: 'active' }],
    });
    busModel.updateLocation.mockResolvedValue({ id: 'bus-1', route_id: 'route-1' });
    bookingModel.detectDestinationArrivals.mockResolvedValue([{
      id: 'booking-1',
      passenger_id: 'passenger-1',
      destination_stop_name: 'Tech Junction',
      arrived_at: '2026-08-10T17:00:00.000Z',
      passenger_push_token: null,
    }]);

    await service.updateLocation('driver-1', { lat: 6.67, lng: -1.57 });

    expect(bookingModel.detectDestinationArrivals).toHaveBeenCalledWith(
      'driver-1',
      { lat: 6.67, lng: -1.57 },
    );
    expect(emitToUser).toHaveBeenCalledWith(
      'passenger-1',
      'booking:arrived',
      expect.objectContaining({ bookingId: 'booking-1' }),
    );
  });

  it('rejects location updates after the driver becomes unavailable', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'bus-1', driver_id: 'driver-1', route_id: 'route-1', status: 'paused' }],
    });

    await expect(service.updateLocation('driver-1', { lat: 6.67, lng: -1.57 }))
      .rejects.toMatchObject({ status: 409 });
    expect(busModel.updateLocation).not.toHaveBeenCalled();
  });
});
