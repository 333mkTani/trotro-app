jest.mock('../../models/alert.model');
jest.mock('../../models/busAlertDelivery.model');
jest.mock('../../models/route.model');
jest.mock('../../models/stop.model');

const alertModel = require('../../models/alert.model');
const deliveryModel = require('../../models/busAlertDelivery.model');
const routeModel = require('../../models/route.model');
const stopModel = require('../../models/stop.model');
const service = require('../alert.service');

describe('alert service delivery cancellation', () => {
  const user = { id: 'passenger-1', role: 'passenger' };
  const alert = {
    id: 'alert-1', passenger_id: user.id, is_active: true,
    alert_time: '2026-08-09T10:00:00.000Z', schedule: null,
  };

  beforeEach(() => jest.clearAllMocks());

  it('uses canonical route and stop names after verifying membership', async () => {
    stopModel.findById.mockResolvedValue({ id: 'stop-1', name: 'Circle', status: 'active' });
    routeModel.findById.mockResolvedValue({ id: 'route-1', name: 'Circle - Madina', status: 'active' });
    routeModel.findStops.mockResolvedValue([{ id: 'stop-1', status: 'active' }]);
    alertModel.insert.mockImplementation(async (data) => data);

    await service.create(user.id, {
      routeId: 'route-1', routeName: 'forged', stopId: 'stop-1', stopName: 'forged',
      alertTime: alert.alert_time, schedule: null, timezone: 'Africa/Accra',
    });
    expect(alertModel.insert).toHaveBeenCalledWith(expect.objectContaining({
      passengerId: user.id, routeName: 'Circle - Madina', stopName: 'Circle',
    }));
  });

  it('rejects a stop outside the selected route', async () => {
    stopModel.findById.mockResolvedValue({ id: 'stop-1', name: 'Circle', status: 'active' });
    routeModel.findById.mockResolvedValue({ id: 'route-1', name: 'Madina', status: 'active' });
    routeModel.findStops.mockResolvedValue([{ id: 'other-stop', status: 'active' }]);
    await expect(service.create(user.id, {
      routeId: 'route-1', stopId: 'stop-1', alertTime: alert.alert_time,
    })).rejects.toThrow('does not belong');
    expect(alertModel.insert).not.toHaveBeenCalled();
  });

  it('cancels pending delivery when an alert is disabled', async () => {
    alertModel.findById.mockResolvedValue(alert);
    alertModel.update.mockResolvedValue({ ...alert, is_active: false });
    await service.update(alert.id, user, { isActive: false });
    expect(deliveryModel.cancelPendingForAlert).toHaveBeenCalledWith(alert.id);
  });

  it('cancels pending delivery before deleting the alert', async () => {
    alertModel.findById.mockResolvedValue(alert);
    await service.remove(alert.id, user);
    expect(deliveryModel.cancelPendingForAlert).toHaveBeenCalledWith(alert.id);
    expect(alertModel.remove).toHaveBeenCalledWith(alert.id);
  });
});
