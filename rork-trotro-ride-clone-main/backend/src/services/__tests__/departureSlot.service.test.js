jest.mock('../../models/departureSlot.model');
jest.mock('../driverProfile.service');

const model = require('../../models/departureSlot.model');
const driverProfile = require('../driverProfile.service');
const service = require('../departureSlot.service');

const input = {
  routeId: 'route-1', departureStopId: 'stop-1', destinationStopId: 'stop-2',
  travelDays: ['mon'], boardingStartLocal: '06:00', boardingEndLocal: '06:20', timezone: 'Africa/Accra',
};

describe('driver departure slot service', () => {
  beforeEach(() => jest.clearAllMocks());

  it('publishes a route-valid slot against the driver bus', async () => {
    driverProfile.getMyBus.mockResolvedValue({ id: 'bus-1', route_id: 'route-1' });
    model.routeContainsStops.mockResolvedValue(true);
    model.insert.mockResolvedValue({ id: 'slot-1' });

    await expect(service.create('driver-1', input)).resolves.toEqual({ id: 'slot-1' });
    expect(model.insert).toHaveBeenCalledWith('driver-1', 'bus-1', input);
  });

  it('rejects a slot for another route', async () => {
    driverProfile.getMyBus.mockResolvedValue({ id: 'bus-1', route_id: 'route-2' });
    await expect(service.create('driver-1', input)).rejects.toThrow('assigned route');
    expect(model.insert).not.toHaveBeenCalled();
  });

  it('rejects stations outside the assigned route', async () => {
    driverProfile.getMyBus.mockResolvedValue({ id: 'bus-1', route_id: 'route-1' });
    model.routeContainsStops.mockResolvedValue(false);
    await expect(service.create('driver-1', input)).rejects.toThrow('belong to the assigned route');
  });
});

