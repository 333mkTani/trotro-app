import { parseBoardingQrPayload } from '../boardingQrPayload';

describe('boarding QR payload parser', () => {
  it('accepts the raw alphanumeric code shown by the passenger app', () => {
    expect(parseBoardingQrPayload('HK7M3R')).toBe('HK7M3R');
    expect(parseBoardingQrPayload(' hk7m3r ')).toBe('HK7M3R');
  });

  it('accepts ordinary and scheduled backend JSON payloads', () => {
    expect(parseBoardingQrPayload(JSON.stringify({ v: 1, b: 'booking-id', c: 'AB2C3D' })))
      .toBe('AB2C3D');
    expect(parseBoardingQrPayload(JSON.stringify({ v: 2, o: 'occurrence-id', c: 'ZX8Y7W' })))
      .toBe('ZX8Y7W');
  });

  it('extracts the code from the exact scheduled QR shape displayed to the scanner', () => {
    const scannedValue = JSON.stringify({
      v: 2,
      o: '4ce93c23-c816-4b5f-a619-4ec7373bb6d2',
      c: 'PQ7R4T',
      exp: '2026-08-10T08:30:00.000Z',
    });

    expect(parseBoardingQrPayload(scannedValue)).toBe('PQ7R4T');
  });

  it('supports the legacy code property without confusing metadata for the code', () => {
    expect(parseBoardingQrPayload(JSON.stringify({
      occurrenceId: 'ABC234',
      code: 'MN5P6Q',
    }))).toBe('MN5P6Q');
  });

  it.each([
    ['', null],
    ['123', null],
    ['ABCIO1', null],
    ['https://example.com/ABC234', null],
    ['{"c":"TOO-LONG"}', null],
    ['{"v":2,"o":"occurrence-id"}', null],
    ['null', null],
    ['[]', null],
    ['not-json', null],
  ])('rejects invalid or unrelated QR content: %s', (payload, expected) => {
    expect(parseBoardingQrPayload(payload)).toBe(expected);
  });
});
