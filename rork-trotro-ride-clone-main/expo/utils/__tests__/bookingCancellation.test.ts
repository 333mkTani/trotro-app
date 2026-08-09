import { isCancellationWindowLocked } from '../bookingCancellation';

const now = Date.parse('2026-08-09T12:00:00Z');

describe('booking cancellation window', () => {
  it('locks cancellation when arrival is less than 30 minutes in the future', () => {
    expect(isCancellationWindowLocked('2026-08-09T12:29:59Z', now)).toBe(true);
  });

  it('allows cancellation when arrival is at least 30 minutes away', () => {
    expect(isCancellationWindowLocked('2026-08-09T12:30:00Z', now)).toBe(false);
  });

  it('allows cancellation for a stale pending request whose arrival time passed', () => {
    expect(isCancellationWindowLocked('2026-08-08T12:00:00Z', now)).toBe(false);
  });
});
