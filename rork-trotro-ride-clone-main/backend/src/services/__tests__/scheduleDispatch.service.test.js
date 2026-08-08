jest.mock('../../models/scheduleOccurrence.model');
jest.mock('../../models/profile.model');
jest.mock('../../models/scheduleNotification.model');
jest.mock('../../config/scheduleRollout', () => ({ isScheduledReservationsEnabled: jest.fn(() => true) }));
jest.mock('../push.service', () => ({ send: jest.fn() }));
jest.mock('../../realtime/io', () => ({ emitToDriver: jest.fn(), emitToUser: jest.fn() }));

const occurrenceModel = require('../../models/scheduleOccurrence.model');
const profileModel = require('../../models/profile.model');
const notificationModel = require('../../models/scheduleNotification.model');
const push = require('../push.service');
const { emitToDriver, emitToUser } = require('../../realtime/io');
const service = require('../scheduleDispatch.service');

const weekdaySchedule = {
  id: 'schedule-1', passenger_id: 'passenger-1',
  travel_days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  boarding_start_local: '06:30:00', boarding_end_local: '07:00:00',
  primary_deadline_local: '20:00:00', backup_matching_enabled: false,
};

describe('schedule dispatch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    occurrenceModel.listActiveSchedules.mockResolvedValue([]);
    occurrenceModel.queueDueReminders.mockResolvedValue(0);
    occurrenceModel.expireUnmatched.mockResolvedValue([]);
    occurrenceModel.claimNotificationJobs.mockResolvedValue([]);
    notificationModel.queueBackupStarted.mockResolvedValue(0);
    notificationModel.queueBackupStopped.mockResolvedValue(0);
    notificationModel.createInApp.mockResolvedValue({ id: 'in-app-1' });
  });

  it('builds a morning occurrence with a previous-evening deadline', () => {
    const result = service.buildOccurrence(weekdaySchedule, new Date('2026-08-10T00:00:00.000Z'));
    expect(result).toMatchObject({
      serviceDate: '2026-08-10',
      boardingStartAt: '2026-08-10T06:30:00.000Z',
      boardingEndAt: '2026-08-10T07:00:00.000Z',
      primaryDeadline: '2026-08-09T20:00:00.000Z',
      finalDeadline: '2026-08-09T20:00:00.000Z',
      boardingOpensAt: '2026-08-10T05:30:00.000Z',
    });
  });

  it('keeps overnight backup matching open until two hours before boarding', () => {
    const result = service.buildOccurrence(
      { ...weekdaySchedule, backup_matching_enabled: true },
      new Date('2026-08-10T00:00:00.000Z'),
    );
    expect(result.finalDeadline).toBe('2026-08-10T04:30:00.000Z');
  });

  it('generates only selected weekdays and queues each new offer once', async () => {
    occurrenceModel.listActiveSchedules.mockResolvedValue([weekdaySchedule]);
    occurrenceModel.insert.mockImplementation(async (candidate) => ({ id: `occ-${candidate.serviceDate}` }));
    occurrenceModel.queueInitialOffers.mockResolvedValue(2);

    const created = await service.generateUpcoming(new Date('2026-08-08T12:00:00.000Z'), 3);

    expect(created).toHaveLength(2); // Monday and Tuesday; weekend is skipped
    expect(occurrenceModel.queueInitialOffers).toHaveBeenCalledTimes(2);
  });

  it('is idempotent when occurrence insertion reports an existing row', async () => {
    occurrenceModel.listActiveSchedules.mockResolvedValue([weekdaySchedule]);
    occurrenceModel.insert.mockResolvedValue(null);
    await service.generateUpcoming(new Date('2026-12-31T12:00:00.000Z'), 4);
    expect(occurrenceModel.queueInitialOffers).not.toHaveBeenCalled();
  });

  it('delivers driver offers and marks the outbox job sent', async () => {
    occurrenceModel.claimNotificationJobs.mockResolvedValue([{
      id: 'job-1', occurrence_id: 'occ-1', recipient_id: 'driver-1', event_type: 'schedule_offer',
      payload: { occurrenceId: 'occ-1', serviceDate: '2026-08-10' },
    }]);
    profileModel.findById.mockResolvedValue({ fcm_token: 'token' });
    push.send.mockResolvedValue({ ok: true });

    await expect(service.deliverNotificationJobs()).resolves.toBe(1);
    expect(emitToDriver).toHaveBeenCalledWith('driver-1', 'schedule:offer', expect.any(Object));
    expect(notificationModel.createInApp).toHaveBeenCalled();
    expect(push.send).toHaveBeenCalledWith('token', expect.objectContaining({ data: expect.objectContaining({ deepLink: '/future-requests?occurrenceId=occ-1' }) }));
    expect(occurrenceModel.markNotificationSent).toHaveBeenCalledWith('job-1');
  });

  it('retries a failed push instead of losing the notification', async () => {
    occurrenceModel.claimNotificationJobs.mockResolvedValue([{
      id: 'job-2', occurrence_id: 'occ-2', recipient_id: 'passenger-1', event_type: 'schedule_unmatched', payload: {},
    }]);
    profileModel.findById.mockResolvedValue({ fcm_token: 'token' });
    push.send.mockRejectedValue(new Error('push unavailable'));

    await expect(service.deliverNotificationJobs()).resolves.toBe(0);
    expect(emitToUser).toHaveBeenCalled();
    expect(occurrenceModel.retryNotification).toHaveBeenCalledWith('job-2', 'push unavailable');
    expect(occurrenceModel.markNotificationSent).not.toHaveBeenCalled();
  });
});
