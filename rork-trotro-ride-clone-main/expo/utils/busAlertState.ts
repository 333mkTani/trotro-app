import { BusAlert } from '@/types';

export function localDateKey(date: Date, timezone = 'Africa/Accra'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).reduce<Record<string, string>>((out, part) => {
    if (part.type !== 'literal') out[part.type] = part.value;
    return out;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function reconcileBusAlerts(remote: BusAlert[], _cached: BusAlert[]): BusAlert[] {
  return remote;
}

export function notificationAlertId(data?: Record<string, unknown>): string | null {
  return data?.type === 'bus_alert' && typeof data.alertId === 'string' ? data.alertId : null;
}
