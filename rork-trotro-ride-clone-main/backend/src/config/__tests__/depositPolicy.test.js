const { calculateDeposit, calculateBookingDeadlines, getDepositPolicy } = require('../depositPolicy');

describe('booking deposit policy', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.BOOKING_DEPOSIT_PERCENT;
    delete process.env.BOOKING_DEPOSIT_MIN_GHS;
    delete process.env.BOOKING_HOLD_MINUTES;
    delete process.env.BOOKING_CANCELLATION_MINUTES;
  });

  afterAll(() => { process.env = originalEnv; });

  it('defaults to 25 percent with a GHS 1 minimum', () => {
    expect(calculateDeposit(10)).toEqual({
      totalFare: 10,
      depositAmount: 2.5,
      remainingBalance: 7.5,
      percentage: 25,
      holdMinutes: 5,
    });
    expect(calculateDeposit(2).depositAmount).toBe(1);
  });

  it('never charges a deposit above the fare', () => {
    process.env.BOOKING_DEPOSIT_MIN_GHS = '10';
    expect(calculateDeposit(4)).toMatchObject({ depositAmount: 4, remainingBalance: 0 });
  });

  it('rounds currency values to two decimal places', () => {
    expect(calculateDeposit(5.55)).toMatchObject({ depositAmount: 1.39, remainingBalance: 4.16 });
  });

  it('clamps unsafe environment values', () => {
    process.env.BOOKING_DEPOSIT_PERCENT = '150';
    process.env.BOOKING_HOLD_MINUTES = '90';
    expect(getDepositPolicy()).toMatchObject({ percentage: 100, holdMinutes: 30 });
  });

  it('rejects missing or non-positive fares', () => {
    expect(() => calculateDeposit(0)).toThrow('A positive route fare is required');
    expect(() => calculateDeposit('unknown')).toThrow('A positive route fare is required');
  });

  it('derives cancellation and boarding deadlines from the pickup window', () => {
    const result = calculateBookingDeadlines('2026-08-12T08:00:00.000Z', 10, {
      cancellationMinutes: 30,
    });
    expect(result).toEqual({
      cancellationDeadline: '2026-08-12T07:30:00.000Z',
      boardingDeadline: '2026-08-12T08:10:00.000Z',
    });
  });
});
