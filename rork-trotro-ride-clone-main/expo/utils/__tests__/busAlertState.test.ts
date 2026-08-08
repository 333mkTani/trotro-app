import { localDateKey, notificationAlertId, reconcileBusAlerts } from '../busAlertState';

describe('bus alert client state', () => {
  it('uses the alert timezone at a UTC midnight boundary', () => {
    const instant = new Date('2026-08-09T00:30:00.000Z');
    expect(localDateKey(instant, 'Africa/Accra')).toBe('2026-08-09');
    expect(localDateKey(instant, 'America/New_York')).toBe('2026-08-08');
  });

  it('does not resurrect alerts deleted on the server', () => {
    expect(reconcileBusAlerts([], [{ id: 'deleted' } as never])).toEqual([]);
  });

  it('extracts an exact alert id from notification data', () => {
    expect(notificationAlertId({ type: 'bus_alert', alertId: 'alert-12' })).toBe('alert-12');
  });
});
