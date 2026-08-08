describe('schedule rollout', () => {
  const load = (enabled, percent) => {
    jest.resetModules();
    process.env.SCHEDULED_RESERVATIONS_ENABLED = String(enabled);
    process.env.SCHEDULED_RESERVATIONS_ROLLOUT_PERCENT = String(percent);
    return require('../scheduleRollout');
  };

  afterEach(() => {
    delete process.env.SCHEDULED_RESERVATIONS_ENABLED;
    delete process.env.SCHEDULED_RESERVATIONS_ROLLOUT_PERCENT;
  });

  it('is disabled by the master flag and supports full rollout', () => {
    expect(load(false, 100).isScheduledReservationsEnabled('passenger-1')).toBe(false);
    expect(load(true, 100).isScheduledReservationsEnabled('passenger-1')).toBe(true);
  });

  it('assigns each passenger to a stable percentage bucket', () => {
    const rollout = load(true, 25);
    expect(rollout.bucketFor('passenger-1')).toBe(rollout.bucketFor('passenger-1'));
    expect(rollout.bucketFor('passenger-1')).toBeGreaterThanOrEqual(0);
    expect(rollout.bucketFor('passenger-1')).toBeLessThan(100);
  });
});
