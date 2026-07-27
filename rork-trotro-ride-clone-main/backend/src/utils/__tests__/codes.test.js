const { generateBoardingCode, buildQrPayload } = require('../codes');

describe('generateBoardingCode', () => {
  it('defaults to 6 characters', () => {
    expect(generateBoardingCode()).toHaveLength(6);
  });

  it('honors a custom length', () => {
    expect(generateBoardingCode(10)).toHaveLength(10);
  });

  it('only uses unambiguous uppercase letters and digits (no 0/O/1/I)', () => {
    const code = generateBoardingCode(200);
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]+$/);
  });

  it('is not deterministic across calls', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateBoardingCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe('buildQrPayload', () => {
  it('serializes booking id, code, and expiry into a versioned JSON payload', () => {
    const payload = buildQrPayload({ bookingId: 'b-1', code: 'ABC123', validUntil: '2026-01-01T00:00:00Z' });

    expect(JSON.parse(payload)).toEqual({
      v: 1,
      b: 'b-1',
      c: 'ABC123',
      exp: '2026-01-01T00:00:00Z',
    });
  });
});
