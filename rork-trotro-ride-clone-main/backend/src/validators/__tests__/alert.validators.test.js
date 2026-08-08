const { CreateAlertSchema, UpdateAlertSchema } = require('../alert.validators');

describe('bus alert validators', () => {
  const base = {
    routeId: null,
    stopId: '11111111-1111-4111-8111-111111111111',
    alertTime: '2026-08-10T07:30:00.000Z',
    timezone: 'Africa/Accra',
  };

  it('accepts a valid one-time alert', () => {
    expect(CreateAlertSchema.parse(base)).toMatchObject({ isActive: true, timezone: 'Africa/Accra' });
  });

  it('accepts complete custom recurring times', () => {
    expect(CreateAlertSchema.parse({
      ...base, alertTime: null,
      schedule: {
        days: ['Mon', 'Wed'], time_mode: 'custom',
        custom_times: [{ day: 'Mon', hour: 7, minute: 0 }, { day: 'Wed', hour: 8, minute: 15 }],
      },
    }).schedule.days).toEqual(['Mon', 'Wed']);
  });

  it('rejects missing custom day times and invalid timezones', () => {
    expect(() => CreateAlertSchema.parse({
      ...base, timezone: 'Not/AZone',
      schedule: { days: ['Mon'], time_mode: 'custom', custom_times: [{ day: 'Tue', hour: 7, minute: 0 }] },
    })).toThrow();
  });

  it('rejects client-authored trigger state', () => {
    expect(() => UpdateAlertSchema.parse({ triggered: true })).toThrow();
    expect(() => UpdateAlertSchema.parse({ triggeredBuses: [{ driver_id: 'fake' }] })).toThrow();
    expect(() => UpdateAlertSchema.parse({ lastTriggeredDay: '2026-08-10' })).toThrow();
  });

  it('rejects an empty or unconfigured alert', () => {
    expect(() => CreateAlertSchema.parse({ ...base, alertTime: null })).toThrow();
    expect(() => UpdateAlertSchema.parse({})).toThrow();
  });
});
