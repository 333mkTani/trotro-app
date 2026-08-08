jest.mock('../../models/busAlertDelivery.model');
jest.mock('../bus.service');
jest.mock('../push.service', () => ({ send: jest.fn() }));
jest.mock('../../realtime/io', () => ({ emitToUser: jest.fn() }));
jest.mock('../../utils/observability', () => ({ increment: jest.fn(), log: jest.fn() }));

const model = require('../../models/busAlertDelivery.model');
const busService = require('../bus.service');
const push = require('../push.service');
const { emitToUser } = require('../../realtime/io');
const service = require('../busAlertWorker.service');

const recurring = {
  id: 'alert-1', passenger_id: 'passenger-1', is_active: true,
  timezone: 'Africa/Accra', last_triggered_day: null,
  schedule: { days: ['Mon'], time_mode: 'same', same_hour: 7, same_minute: 30 },
};

describe('bus alert worker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    model.listActive.mockResolvedValue([]);
    model.claimJobs.mockResolvedValue([]);
    model.persistDelivery.mockResolvedValue(true);
  });

  it('evaluates a recurring alert once its local scheduled time is reached', () => {
    expect(service.dueFor(recurring, new Date('2026-08-10T07:29:00Z'))).toBeNull();
    expect(service.dueFor(recurring, new Date('2026-08-10T07:30:00Z'))).toMatchObject({
      localDate: '2026-08-10',
    });
  });

  it('uses the configured timezone for the local day boundary', () => {
    const alert = {
      ...recurring, timezone: 'Pacific/Auckland',
      schedule: { days: ['Tue'], time_mode: 'same', same_hour: 0, same_minute: 15 },
    };
    expect(service.dueFor(alert, new Date('2026-08-10T12:15:00Z'))).toMatchObject({
      localDate: '2026-08-11',
    });
  });

  it('does not recreate a trigger when the database uniqueness claim loses', async () => {
    model.listActive.mockResolvedValue([recurring]);
    model.createTrigger.mockResolvedValue(null);
    await expect(service.evaluateDue(new Date('2026-08-10T08:00:00Z'))).resolves.toBe(0);
  });

  it('persists and delivers a no-bus result with an exact alert deep link', async () => {
    model.claimJobs.mockResolvedValue([{ id: 'job-1', trigger_occurrence_id: 'trigger-1' }]);
    model.getDeliveryContext.mockResolvedValue({
      id: 'trigger-1', status: 'pending', alert_id: 'alert-1', passenger_id: 'passenger-1',
      stop_id: 'stop-1', stop_name: 'Circle', route_id: null, fcm_token: null,
    });
    busService.listApproachingStop.mockResolvedValue([]);

    await expect(service.deliverDue()).resolves.toBe(1);
    expect(model.persistDelivery).toHaveBeenCalledWith(
      expect.any(Object), [], expect.objectContaining({ title: 'Bus alert check' }),
      expect.objectContaining({ deepLink: '/alert-buses?alertId=alert-1', busCount: 0 }),
      true,
    );
    expect(emitToUser).toHaveBeenCalledWith(
      'passenger-1', 'bus-alert:triggered', expect.objectContaining({ alertId: 'alert-1' }),
    );
    expect(model.markSent).toHaveBeenCalledWith('job-1', 'trigger-1');
  });

  it('captures server state but suppresses delivery when bus alerts are disabled', async () => {
    model.claimJobs.mockResolvedValue([{ id: 'job-off', trigger_occurrence_id: 'trigger-off' }]);
    model.getDeliveryContext.mockResolvedValue({
      id: 'trigger-off', status: 'pending', alert_id: 'alert-off', passenger_id: 'passenger-off',
      stop_id: 'stop-1', stop_name: 'Circle', route_id: null, fcm_token: 'token',
      bus_alerts_enabled: false,
    });
    busService.listApproachingStop.mockResolvedValue([]);

    await expect(service.deliverDue()).resolves.toBe(1);
    expect(model.persistDelivery).toHaveBeenCalledWith(
      expect.any(Object), [], expect.any(Object), expect.any(Object), false,
    );
    expect(emitToUser).not.toHaveBeenCalled();
    expect(push.send).not.toHaveBeenCalled();
    expect(model.markSent).toHaveBeenCalledWith('job-off', 'trigger-off');
  });

  it('does not emit or push when cancellation wins the delivery lock', async () => {
    model.claimJobs.mockResolvedValue([{ id: 'job-cancel', trigger_occurrence_id: 'trigger-cancel' }]);
    model.getDeliveryContext.mockResolvedValue({
      id: 'trigger-cancel', status: 'pending', alert_id: 'alert-cancel', passenger_id: 'passenger-1',
      stop_id: 'stop-1', stop_name: 'Circle', route_id: null, fcm_token: 'token',
    });
    busService.listApproachingStop.mockResolvedValue([{ driver_id: 'driver-1' }]);
    model.persistDelivery.mockResolvedValue(false);

    await expect(service.deliverDue()).resolves.toBe(0);
    expect(emitToUser).not.toHaveBeenCalled();
    expect(push.send).not.toHaveBeenCalled();
    expect(model.markSent).not.toHaveBeenCalled();
    expect(model.retry).not.toHaveBeenCalled();
  });

  it('retries a failed push without marking the trigger delivered', async () => {
    model.claimJobs.mockResolvedValue([{ id: 'job-2', trigger_occurrence_id: 'trigger-2' }]);
    model.getDeliveryContext.mockResolvedValue({
      id: 'trigger-2', status: 'pending', alert_id: 'alert-2', passenger_id: 'passenger-2',
      stop_id: 'stop-2', stop_name: 'Madina', route_id: null, fcm_token: 'token',
    });
    busService.listApproachingStop.mockResolvedValue([{ driver_id: 'driver-1' }]);
    push.send.mockRejectedValue(new Error('push unavailable'));

    await expect(service.deliverDue()).resolves.toBe(0);
    expect(model.retry).toHaveBeenCalledWith('job-2', 'push unavailable');
    expect(model.markSent).not.toHaveBeenCalled();
  });
});
