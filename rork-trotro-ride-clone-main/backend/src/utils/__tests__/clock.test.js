describe('schedule test clock', () => {
  afterEach(() => {
    delete process.env.SCHEDULE_TEST_NOW;
    jest.resetModules();
  });

  it('freezes time in the test environment', () => {
    process.env.SCHEDULE_TEST_NOW = '2026-08-10T05:30:00.000Z';
    const { now } = require('../clock');
    expect(now().toISOString()).toBe('2026-08-10T05:30:00.000Z');
  });
});
