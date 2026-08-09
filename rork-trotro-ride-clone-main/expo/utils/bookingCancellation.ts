const CANCELLATION_LOCK_MS = 30 * 60 * 1000;

export const isCancellationWindowLocked = (
  desiredArrivalTime: string,
  nowMs = Date.now(),
) => {
  const arrivalMs = new Date(desiredArrivalTime).getTime();
  if (!Number.isFinite(arrivalMs)) return false;
  const remainingMs = arrivalMs - nowMs;
  return remainingMs >= 0 && remainingMs < CANCELLATION_LOCK_MS;
};
