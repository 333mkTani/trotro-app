import { createPaymentAttemptKey } from '../paymentIdempotency';

describe('deposit payment idempotency keys', () => {
  it('is deterministic for supplied clock and randomness', () => {
    expect(createPaymentAttemptKey('booking-123', 1000, 0.5))
      .toBe(createPaymentAttemptKey('booking-123', 1000, 0.5));
  });

  it('contains only backend-approved characters', () => {
    expect(createPaymentAttemptKey('booking/with unsafe spaces', 1000, 0.5))
      .toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('changes for a new payment attempt', () => {
    expect(createPaymentAttemptKey('booking-123', 1000, 0.1))
      .not.toBe(createPaymentAttemptKey('booking-123', 1001, 0.2));
  });
});
