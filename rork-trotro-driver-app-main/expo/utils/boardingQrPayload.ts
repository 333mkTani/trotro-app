const BOARDING_CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

const validCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return BOARDING_CODE.test(normalized) ? normalized : null;
};

/**
 * Passenger QR screens currently encode the boarding code directly. The
 * backend also stores a versioned JSON payload with the code in `c`, which is
 * accepted here so either representation remains scannable.
 */
export function parseBoardingQrPayload(raw: unknown): string | null {
  const direct = validCode(raw);
  if (direct) return direct;
  if (typeof raw !== 'string') return null;

  try {
    const payload = JSON.parse(raw) as Record<string, unknown>;
    return validCode(payload.c ?? payload.code);
  } catch {
    return null;
  }
}

export { BOARDING_CODE };
