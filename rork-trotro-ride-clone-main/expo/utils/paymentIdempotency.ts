export function createPaymentAttemptKey(bookingId: string, now = Date.now(), random = Math.random()): string {
  const safeBookingId = bookingId.replace(/[^A-Za-z0-9]/g, '').slice(0, 20);
  const randomPart = Math.floor(random * 0xFFFFFF).toString(36).padStart(5, '0');
  return `deposit_${safeBookingId}_${now.toString(36)}_${randomPart}`;
}
