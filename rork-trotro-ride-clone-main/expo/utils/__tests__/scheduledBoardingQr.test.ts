import { getScheduledBoardingQrValue } from '../scheduledBoardingQr';

describe('getScheduledBoardingQrValue', () => {
  it('uses the versioned scheduled payload when available', () => {
    const payload = JSON.stringify({ v: 2, o: 'occurrence-id', c: 'ABC234' });

    expect(getScheduledBoardingQrValue({
      status: 'boarding_open',
      code_status: 'active',
      boarding_code: 'ABC234',
      boarding_qr_payload: payload,
    })).toBe(payload);
  });

  it('falls back to the manual code when no payload is returned', () => {
    expect(getScheduledBoardingQrValue({
      status: 'boarding_open',
      code_status: 'active',
      boarding_code: 'ABC234',
    })).toBe('ABC234');
  });

  it('does not expose a QR outside the active boarding window', () => {
    expect(getScheduledBoardingQrValue({
      status: 'accepted',
      code_status: 'active',
      boarding_code: 'ABC234',
    })).toBeNull();

    expect(getScheduledBoardingQrValue({
      status: 'boarding_open',
      code_status: 'used',
      boarding_code: 'ABC234',
    })).toBeNull();
  });
});
