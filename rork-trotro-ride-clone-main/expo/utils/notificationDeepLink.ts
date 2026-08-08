export function resolveNotificationRoute(data?: Record<string, unknown>): string | null {
  if (typeof data?.deepLink === 'string' && data.deepLink.startsWith('/')) return data.deepLink;
  if (data?.type === 'bus_approaching' && data.bookingId) return '/ride-notification';
  if (data?.type === 'bus_alert' && data.alertId) return `/alert-buses?alertId=${encodeURIComponent(String(data.alertId))}`;
  if (data?.type === 'booking_arrived' && data.bookingId) return '/(tabs)/rides';
  return null;
}
