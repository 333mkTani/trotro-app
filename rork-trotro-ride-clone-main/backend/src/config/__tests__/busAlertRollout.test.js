describe('bus alert rollout', () => {
  const load = (enabled, percent) => {
    jest.resetModules();
    process.env.BUS_ALERTS_ENABLED = String(enabled);
    process.env.BUS_ALERTS_ROLLOUT_PERCENT = String(percent);
    return require('../busAlertRollout');
  };

  afterEach(() => {
    delete process.env.BUS_ALERTS_ENABLED;
    delete process.env.BUS_ALERTS_ROLLOUT_PERCENT;
  });

  it('supports zero and full rollout independently of scheduled reservations', () => {
    expect(load(true, 0).isBusAlertsEnabled('passenger-1')).toBe(false);
    expect(load(true, 100).isBusAlertsEnabled('passenger-1')).toBe(true);
    expect(load(false, 100).isBusAlertsEnabled('passenger-1')).toBe(false);
  });

  it('assigns stable partial-rollout buckets', () => {
    const rollout = load(true, 25);
    expect(rollout.bucketFor('passenger-1')).toBe(rollout.bucketFor('passenger-1'));
    expect(rollout.bucketFor('passenger-1')).toBeGreaterThanOrEqual(0);
    expect(rollout.bucketFor('passenger-1')).toBeLessThan(100);
  });
});
