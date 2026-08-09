import { getScheduleNotificationRoute, processColdStartNotification } from '../scheduleNotificationRoute';

describe('schedule notification routing', () => {
  it('constructs an encoded occurrence deep link', () => {
    expect(getScheduleNotificationRoute({ type: 'schedule_offer', occurrenceId: 'occ/1 ?' }))
      .toBe('/future-requests?occurrenceId=occ%2F1%20%3F');
  });

  it('ignores non-schedule notifications', () => {
    expect(getScheduleNotificationRoute({ type: 'new_request' })).toBeNull();
  });

  it('processes and clears a cold-start response once', async () => {
    const data = { type: 'schedule_offer', occurrenceId: 'occ-1' };
    const api = {
      getLastNotificationResponseAsync: jest.fn().mockResolvedValue({ notification: { request: { content: { data } } } }),
      clearLastNotificationResponseAsync: jest.fn().mockResolvedValue(undefined),
    };
    const handler = jest.fn();
    await expect(processColdStartNotification(api, handler)).resolves.toBe(true);
    expect(handler).toHaveBeenCalledWith(data);
    expect(api.clearLastNotificationResponseAsync).toHaveBeenCalledTimes(1);
  });
});
