jest.mock('../../models/booking.model');
jest.mock('../../models/code.model');
jest.mock('../../models/bus.model');
jest.mock('../../models/rating.model');
jest.mock('../../models/driver.model');
jest.mock('../../models/profile.model');
jest.mock('../../models/route.model');
jest.mock('../../models/scheduleLifecycle.model');
jest.mock('../push.service', () => ({ send: jest.fn() }));
jest.mock('../../realtime/io', () => ({
  emitToDriver: jest.fn(), emitToRoute: jest.fn(), emitToUser: jest.fn(),
}));
jest.mock('../../config/db', () => ({
  withTransaction: jest.fn((fn) => fn({ fakeClient: true })),
}));

const bookingModel = require('../../models/booking.model');
const routeModel = require('../../models/route.model');
const bookingService = require('../booking.service');

describe('provisional payment-backed booking', () => {
  const data = {
    routeId: 'route-1',
    busId: 'bus-1',
    driverId: 'driver-1',
    pickupStopId: 'pickup-1',
    pickupStopName: 'Pickup',
    destinationStopId: 'destination-1',
    destinationStopName: 'Destination',
    desiredArrivalTime: '2026-08-12T08:00:00.000Z',
    bufferMinutes: 10,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BOOKING_DEPOSIT_PERCENT = '25';
    process.env.BOOKING_DEPOSIT_MIN_GHS = '1';
    process.env.BOOKING_HOLD_MINUTES = '5';
    routeModel.findById.mockResolvedValue({
      id: 'route-1', name: 'Adum - KNUST', status: 'active', fare: '10.00',
    });
    routeModel.findStops.mockResolvedValue([
      { id: 'pickup-1' }, { id: 'destination-1' },
    ]);
    bookingModel.lockBusForProvisionalHold.mockResolvedValue({
      id: 'bus-1', driver_id: 'driver-1', route_id: 'route-1',
      status: 'active', seats_available: 2,
    });
    bookingModel.countActiveProvisionalHolds.mockResolvedValue(0);
    bookingModel.findActiveProvisionalHold.mockResolvedValue(null);
    bookingModel.insertProvisional.mockImplementation(async (input) => ({
      id: 'booking-1', payment_status: 'deposit_pending', ...input,
    }));
  });

  it('uses the authoritative route fare and returns the deposit breakdown', async () => {
    const result = await bookingService.createProvisional('passenger-1', data);

    expect(bookingModel.insertProvisional).toHaveBeenCalledWith(
      expect.objectContaining({
        passengerId: 'passenger-1', totalFare: 10,
        depositAmount: 2.5, remainingBalance: 7.5,
      }),
      expect.anything(),
    );
    expect(result.payment).toMatchObject({
      currency: 'GHS', totalFare: 10, depositAmount: 2.5,
      remainingBalance: 7.5, status: 'deposit_pending',
    });
  });

  it('rejects a bus that is no longer assigned to the selected route and driver', async () => {
    bookingModel.lockBusForProvisionalHold.mockResolvedValue({
      id: 'bus-1', driver_id: 'another-driver', route_id: 'route-1',
      status: 'active', seats_available: 2,
    });

    await expect(bookingService.createProvisional('passenger-1', data)).rejects.toThrow(
      'The selected bus is no longer available for this route',
    );
    expect(bookingModel.insertProvisional).not.toHaveBeenCalled();
  });

  it('rejects stops that are not on the selected route', async () => {
    routeModel.findStops.mockResolvedValue([{ id: 'pickup-1' }]);
    await expect(bookingService.createProvisional('passenger-1', data)).rejects.toThrow(
      'Pickup and destination stops must belong to the selected route',
    );
  });

  it('counts live holds under the bus lock and prevents oversubscription', async () => {
    bookingModel.countActiveProvisionalHolds.mockResolvedValue(2);
    await expect(bookingService.createProvisional('passenger-1', data)).rejects.toThrow(
      'This bus has no seats available',
    );
    expect(bookingModel.insertProvisional).not.toHaveBeenCalled();
  });

  it('reuses the passenger existing live hold instead of holding another seat', async () => {
    bookingModel.findActiveProvisionalHold.mockResolvedValue({
      id: 'existing-booking', total_fare: '10.00', deposit_amount: '2.50',
      remaining_balance: '7.50', payment_status: 'deposit_pending',
      hold_expires_at: '2026-08-12T07:55:00.000Z',
    });

    const result = await bookingService.createProvisional('passenger-1', data);

    expect(result).toMatchObject({
      reused: true,
      booking: { id: 'existing-booking' },
      payment: { totalFare: 10, depositAmount: 2.5, remainingBalance: 7.5 },
    });
    expect(bookingModel.countActiveProvisionalHolds).not.toHaveBeenCalled();
    expect(bookingModel.insertProvisional).not.toHaveBeenCalled();
  });

  it('rejects a route without a positive configured fare', async () => {
    routeModel.findById.mockResolvedValue({
      id: 'route-1', name: 'Adum - KNUST', status: 'active', fare: null,
    });
    await expect(bookingService.createProvisional('passenger-1', data)).rejects.toThrow(
      'Route fare is not configured',
    );
  });
});
