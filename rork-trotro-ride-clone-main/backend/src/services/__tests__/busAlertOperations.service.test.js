jest.mock('../../models/busAlertOperations.model');
const model = require('../../models/busAlertOperations.model');
const service = require('../busAlertOperations.service');

describe('bus alert operations service', () => {
  it('returns configuration, snapshots, jobs and notifications as one trace', async () => {
    model.traceAlert.mockResolvedValue({
      alert: { id: 'alert-1' },
      occurrences: [{ id: 'trigger-1', buses: [{ driver_id: 'driver-1' }] }],
      jobs: [{ status: 'sent', attempts: 1 }], notifications: [{ alert_id: 'alert-1' }],
    });
    await expect(service.traceAlert('alert-1')).resolves.toMatchObject({
      alert: { id: 'alert-1' }, occurrences: [{ id: 'trigger-1' }], jobs: [{ status: 'sent' }],
    });
  });

  it('returns 404 for an unknown alert', async () => {
    model.traceAlert.mockResolvedValue(null);
    await expect(service.traceAlert('missing')).rejects.toMatchObject({ status: 404 });
  });
});
