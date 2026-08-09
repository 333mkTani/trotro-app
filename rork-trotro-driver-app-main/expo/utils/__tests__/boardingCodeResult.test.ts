import { verifyScheduledThenOrdinary } from '../boardingCodeResult';

describe('scheduled boarding fallback', () => {
  it('falls back to ordinary redemption only when the scheduled code is absent', async () => {
    const scheduled = jest.fn().mockRejectedValue(new Error('Boarding code not found'));
    const ordinary = jest.fn().mockResolvedValue({ success: true });
    await expect(verifyScheduledThenOrdinary('123456', scheduled, ordinary))
      .resolves.toMatchObject({ success: true, source: 'IMMEDIATE' });
    expect(ordinary).toHaveBeenCalledWith('123456');
  });

  it.each([
    ['Boarding code expired', 'CODE_EXPIRED'],
    ['Code is assigned to another driver', 'WRONG_DRIVER'],
  ])('does not fall back for %s', async (message, errorCode) => {
    const scheduled = jest.fn().mockRejectedValue(new Error(message));
    const ordinary = jest.fn();
    await expect(verifyScheduledThenOrdinary('123456', scheduled, ordinary))
      .resolves.toMatchObject({ success: false, source: 'SCHEDULED', error_code: errorCode });
    expect(ordinary).not.toHaveBeenCalled();
  });
});
