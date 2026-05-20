export function formatTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  } catch {
    return isoString;
  }
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

export function formatTimeAgo(isoString: string): string {
  try {
    const now = Date.now();
    const then = new Date(isoString).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  } catch {
    return '';
  }
}

export function getTimeRemaining(expiresAt: string): { text: string; isUrgent: boolean } {
  try {
    const now = Date.now();
    const expiry = new Date(expiresAt).getTime();
    const diffMs = expiry - now;
    if (diffMs <= 0) return { text: 'Expired', isUrgent: true };
    const diffMin = Math.floor(diffMs / 60000);
    const diffSec = Math.floor((diffMs % 60000) / 1000);
    if (diffMin < 5) {
      return { text: `${diffMin}:${diffSec.toString().padStart(2, '0')}`, isUrgent: true };
    }
    return { text: `${diffMin} min`, isUrgent: false };
  } catch {
    return { text: 'Unknown', isUrgent: false };
  }
}

export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) *
    Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getSeatColor(available: number, total: number): string {
  const ratio = available / total;
  if (ratio > 0.5) return '#2E7D32';
  if (ratio > 0.2) return '#F57C00';
  return '#C62828';
}

export function formatScheduleTime(time: string): string {
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${(minutes ?? 0).toString().padStart(2, '0')} ${ampm}`;
  } catch {
    return time;
  }
}
