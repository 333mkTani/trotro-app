jest.mock('../../models/booking.model');
jest.mock('../../models/code.model');
jest.mock('../../models/bus.model');
jest.mock('../../models/rating.model');
jest.mock('../../models/driver.model');
jest.mock('../../models/profile.model');
jest.mock('../push.service', () => ({ send: jest.fn() }));
jest.mock('../../realtime/io', () => ({
  emitToDriver: jest.fn(),
  emitToRoute: jest.fn(),
}));
jest.mock('../../config/db', () => ({
  withTransaction: jest.fn((fn) => fn({ fakeClient: true })),
}));
jest.mock('../../utils/codes', () => ({
  generateBoardingCode: jest.fn(() => '123456'),
  buildQrPayload: jest.fn(() => 'qr-payload'),
}));

const bookingModel = require('../../models/booking.model');
const codeModel = require('../../models/code.model');
const busModel = require('../../models/bus.model');
const profileModel = require('../../models/profile.model');
const { emitToDriver } = require('../../realtime/io');
const bookingService = require('../booking.service');

describe('booking creation respects server-side driver state', () => {
  const data = {
    driverId: 'driver-1',
    busId: 'bus-1',
    routeId: 'route-1',
    pickupStopId: 'pickup-1',
    pickupStopName: 'Pickup',
    destinationStopId: 'destination-1',
    destinationStopName: 'Destination',
    desiredArrivalTime: '2026-08-08T08:00:00.000Z',
    bufferMinutes: 10,
  };
  const pending = {
    id: 'booking-1',
    status: 'pending',
    driver_id: 'driver-1',
    bus_id: 'bus-1',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    bookingModel.insert.mockResolvedValue(pending);
    profileModel.findById.mockResolvedValue(null);
  });

  it('rejects a stale booking when the driver is unavailable', async () => {
    busModel.findById.mockResolvedValue({
      id: 'bus-1', driver_id: 'driver-1', status: 'paused',
      driving_status: 'STATIONARY', seats_available: 5,
    });

    await expect(bookingService.create('passenger-1', data)).rejects.toThrow(
      'This driver is currently unavailable',
    );
    expect(busModel.reserveSeatForAutoAccept).not.toHaveBeenCalled();
    expect(bookingModel.updateStatus).not.toHaveBeenCalled();
  });

  it('keeps an available stationary driver booking pending without consuming a seat', async () => {
    busModel.findById.mockResolvedValue({
      id: 'bus-1', driver_id: 'driver-1', status: 'active',
      driving_status: 'STATIONARY', seats_available: 5,
    });

    await expect(bookingService.create('passenger-1', data)).resolves.toEqual(pending);
    expect(emitToDriver).toHaveBeenCalledWith('driver-1', 'booking:new', pending);
    expect(busModel.reserveSeatForAutoAccept).not.toHaveBeenCalled();
    expect(bookingModel.updateStatus).not.toHaveBeenCalled();
    expect(codeModel.insert).not.toHaveBeenCalled();
  });

  it('auto-confirms and reserves a seat only for an available en-route driver', async () => {
    busModel.findById.mockResolvedValue({
      id: 'bus-1', driver_id: 'driver-1', status: 'active',
      driving_status: 'EN_ROUTE', seats_available: 5,
    });
    busModel.reserveSeatForAutoAccept.mockResolvedValue({ id: 'bus-1', seats_available: 4 });
    bookingModel.updateStatus.mockResolvedValue({ ...pending, status: 'confirmed' });
    codeModel.insert.mockResolvedValue({ code: '123456', valid_until: '2026-08-09T08:00:00.000Z' });

    const result = await bookingService.create('passenger-1', data);

    expect(busModel.reserveSeatForAutoAccept).toHaveBeenCalledWith('bus-1', expect.anything());
    expect(bookingModel.updateStatus).toHaveBeenCalledWith(
      'booking-1', 'confirmed', { driverId: 'driver-1', busId: 'bus-1' }, expect.anything(),
    );
    expect(result).toMatchObject({ status: 'confirmed', verification_code: '123456' });
  });
});
