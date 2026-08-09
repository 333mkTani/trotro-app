import { resolveNotificationRoute } from '../notificationDeepLink';

describe('notification deep links', () => {
  it('opens the exact bus alert', () => {
    expect(resolveNotificationRoute({ type: 'bus_alert', alertId: 'alert 12' }))
      .toBe('/alert-buses?alertId=alert%2012');
  });

  it('opens the exact scheduled occurrence', () => {
    expect(resolveNotificationRoute({
      type: 'schedule_accepted', occurrenceId: 'occ-1',
      deepLink: '/(tabs)/schedule?occurrenceId=occ-1',
    })).toBe('/future-seats?occurrenceId=occ-1');
  });

  it('retains immediate-booking routes', () => {
    expect(resolveNotificationRoute({ type: 'bus_approaching', bookingId: 'booking-1' }))
      .toBe('/ride-notification');
  });

  it('rejects external URLs', () => {
    expect(resolveNotificationRoute({ deepLink: 'https://malicious.example' })).toBeNull();
  });
});
