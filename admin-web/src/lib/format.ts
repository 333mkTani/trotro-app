const cedis = new Intl.NumberFormat('en-GH', {
  style: 'currency', currency: 'GHS', minimumFractionDigits: 2,
});

const compact = new Intl.NumberFormat('en-GH', { notation: 'compact', maximumFractionDigits: 1 });

export const money = (value: number | null | undefined) => cedis.format(Number(value ?? 0));

export const compactMoney = (value: number | null | undefined) =>
  `GH₵${compact.format(Number(value ?? 0))}`;

export const count = (value: number | null | undefined) =>
  new Intl.NumberFormat('en-GH').format(Number(value ?? 0));

export const dateTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GH', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export const dayLabel = (isoDay: string) => {
  const date = new Date(`${isoDay}T00:00:00Z`);
  return date.toLocaleDateString('en-GH', { day: '2-digit', month: 'short' });
};

export const relative = (seconds: number | null | undefined) => {
  if (seconds == null) return 'never';
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h ago`;
  return `${Math.round(seconds / 86400)}d ago`;
};

export const titleCase = (value: string | null | undefined) =>
  (value ?? '—').replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

/** Today, as YYYY-MM-DD, for date inputs. */
export const todayIso = () => new Date().toISOString().slice(0, 10);

export const daysAgoIso = (days: number) =>
  new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
