import {
  formatTime,
  formatDistance,
  formatTimeAgo,
  getTimeRemaining,
  haversineDistance,
  getSeatColor,
  formatScheduleTime,
} from '../helpers';

describe('formatTime', () => {
  it('formats a morning ISO timestamp as 12-hour AM', () => {
    expect(formatTime('2026-01-01T09:05:00')).toBe('9:05 AM');
  });

  it('formats an afternoon ISO timestamp as 12-hour PM', () => {
    expect(formatTime('2026-01-01T15:30:00')).toBe('3:30 PM');
  });

  it('renders midnight as 12 AM, not 0 AM', () => {
    expect(formatTime('2026-01-01T00:00:00')).toBe('12:00 AM');
  });

  it('falls back to the raw input on an unparseable string', () => {
    const original = Date;
    // Force `new Date(...)` to throw inside formatTime's try block.
    // @ts-expect-error intentional override for the test
    global.Date = class extends original {
      constructor(...args: unknown[]) {
        // @ts-expect-error spreading unknown[] into Date constructor
        super(...args);
        throw new Error('boom');
      }
    };

    expect(formatTime('not-a-date')).toBe('not-a-date');

    global.Date = original;
  });
});

describe('formatDistance', () => {
  it('renders sub-kilometer distances in meters', () => {
    expect(formatDistance(0.35)).toBe('350 m');
  });

  it('renders kilometer-plus distances with one decimal', () => {
    expect(formatDistance(4.567)).toBe('4.6 km');
  });
});

describe('formatTimeAgo', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports "Just now" for events under a minute old', () => {
    expect(formatTimeAgo(new Date('2026-01-01T11:59:45Z').toISOString())).toBe('Just now');
  });

  it('reports minutes for events under an hour old', () => {
    expect(formatTimeAgo(new Date('2026-01-01T11:45:00Z').toISOString())).toBe('15 min ago');
  });

  it('reports hours for events under a day old', () => {
    expect(formatTimeAgo(new Date('2026-01-01T09:00:00Z').toISOString())).toBe('3h ago');
  });

  it('reports days for events a day or more old', () => {
    expect(formatTimeAgo(new Date('2025-12-30T12:00:00Z').toISOString())).toBe('2d ago');
  });
});

describe('getTimeRemaining', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T12:00:00Z'));
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks an already-passed expiry as Expired and urgent', () => {
    expect(getTimeRemaining(new Date('2026-01-01T11:59:00Z').toISOString())).toEqual({
      text: 'Expired',
      isUrgent: true,
    });
  });

  it('shows a mm:ss countdown and flags urgency under 5 minutes', () => {
    expect(getTimeRemaining(new Date('2026-01-01T12:02:30Z').toISOString())).toEqual({
      text: '2:30',
      isUrgent: true,
    });
  });

  it('shows a plain minute count and no urgency for 5+ minutes remaining', () => {
    expect(getTimeRemaining(new Date('2026-01-01T12:10:00Z').toISOString())).toEqual({
      text: '10 min',
      isUrgent: false,
    });
  });
});

describe('haversineDistance', () => {
  it('returns ~0 for identical coordinates', () => {
    expect(haversineDistance(5.6, -0.18, 5.6, -0.18)).toBeCloseTo(0, 5);
  });

  it('computes a plausible distance between two known Accra-area points', () => {
    // Spintex-ish to Tema Station-ish, roughly a few km apart.
    const km = haversineDistance(5.6100, -0.1200, 5.6600, -0.0100);
    expect(km).toBeGreaterThan(10);
    expect(km).toBeLessThan(20);
  });
});

describe('getSeatColor', () => {
  it('returns green when more than half the seats are free', () => {
    expect(getSeatColor(8, 14)).toBe('#2E7D32');
  });

  it('returns amber when between 20% and 50% of seats are free', () => {
    expect(getSeatColor(3, 14)).toBe('#F57C00');
  });

  it('returns red when 20% or fewer seats are free', () => {
    expect(getSeatColor(1, 14)).toBe('#C62828');
  });
});

describe('formatScheduleTime', () => {
  it('formats a 24-hour HH:mm string as 12-hour with AM/PM', () => {
    expect(formatScheduleTime('08:05')).toBe('8:05 AM');
    expect(formatScheduleTime('17:30')).toBe('5:30 PM');
    expect(formatScheduleTime('00:00')).toBe('12:00 AM');
  });
});
