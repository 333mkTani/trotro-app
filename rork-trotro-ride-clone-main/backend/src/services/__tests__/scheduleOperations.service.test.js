jest.mock('../../models/scheduleOperations.model');

const model = require('../../models/scheduleOperations.model');
const service = require('../scheduleOperations.service');

describe('schedule operations service', () => {
  it('returns a complete occurrence trace', async () => {
    model.traceOccurrence.mockResolvedValue({
      occurrence: { id: 'occ-1' }, responses: [], reservations: [],
      boardingCodes: [], notificationJobs: [], inAppNotifications: [],
    });
    await expect(service.traceOccurrence('occ-1')).resolves.toMatchObject({
      occurrence: { id: 'occ-1' }, notificationJobs: [],
    });
  });

  it('rejects an unknown occurrence', async () => {
    model.traceOccurrence.mockResolvedValue(null);
    await expect(service.traceOccurrence('missing')).rejects.toMatchObject({ status: 404 });
  });
});
