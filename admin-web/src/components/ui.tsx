import type { ReactNode } from 'react';
import { titleCase } from '../lib/format';

export function Card({ title, action, children, bodyless = false }: {
  title?: ReactNode; action?: ReactNode; children: ReactNode; bodyless?: boolean;
}) {
  return (
    <section className="card">
      {(title || action) && (
        <div className="card-head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {action}
        </div>
      )}
      {bodyless ? children : <div className="card-body">{children}</div>}
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint != null && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

type Tone = 'neutral' | 'good' | 'warn' | 'bad' | 'info';

const BOOKING_TONES: Record<string, Tone> = {
  pending: 'warn', confirmed: 'info', completed: 'good', cancelled: 'bad', expired: 'neutral',
};

const PAYMENT_TONES: Record<string, Tone> = {
  unpaid: 'neutral', deposit_pending: 'warn', deposit_paid: 'info', balance_pending: 'warn',
  fully_paid: 'good', refund_pending: 'warn', partially_refunded: 'warn', refunded: 'neutral',
  failed: 'bad',
};

const LOCATION_TONES: Record<string, Tone> = { live: 'good', stale: 'warn', offline: 'bad' };

const ENTITY_TONES: Record<string, Tone> = { active: 'good', paused: 'warn', deleted: 'bad' };

export function Badge({ value, kind = 'plain' }: {
  value: string | null | undefined;
  kind?: 'plain' | 'booking' | 'payment' | 'location' | 'entity';
}) {
  if (!value) return <span className="dim">—</span>;
  const table = kind === 'booking' ? BOOKING_TONES
    : kind === 'payment' ? PAYMENT_TONES
      : kind === 'location' ? LOCATION_TONES
        : kind === 'entity' ? ENTITY_TONES
          : {};
  const tone = table[value] ?? 'neutral';
  return <span className={`badge ${tone === 'neutral' ? '' : tone}`}>{titleCase(value)}</span>;
}

export function Skeleton({ width = '100%', height = 16, radius = 8, className = '' }: {
  width?: string; height?: number; radius?: number; className?: string;
}) {
  return <span
    className={`skeleton ${className}`}
    aria-hidden="true"
    style={{ width, height, borderRadius: radius }}
  />;
}

export function DashboardSkeleton() {
  return <div className="skeleton-page" role="status" aria-label="Loading dashboard">
    <div className="grid grid-4">{[1, 2, 3, 4].map((item) => <div className="card stat" key={item}><Skeleton width="58%" height={12} /><Skeleton width="46%" height={28} className="skeleton-gap" /><Skeleton width="72%" height={12} className="skeleton-gap-small" /></div>)}</div>
    <div className="grid grid-4">{[1, 2, 3, 4].map((item) => <div className="card stat" key={item}><Skeleton width="48%" height={12} /><Skeleton width="40%" height={28} className="skeleton-gap" /><Skeleton width="68%" height={12} className="skeleton-gap-small" /></div>)}</div>
    <div className="grid grid-2"><div className="card skeleton-card"><Skeleton width="35%" height={18} /><Skeleton width="100%" height={150} className="skeleton-gap" /></div><div className="card skeleton-card"><Skeleton width="34%" height={18} /><Skeleton width="100%" height={150} className="skeleton-gap" /></div></div>
    <div className="card skeleton-card"><Skeleton width="24%" height={18} /><div className="skeleton-table">{[1, 2, 3, 4, 5].map((item) => <div className="skeleton-table-row" key={item}><Skeleton width="20%" height={13} /><Skeleton width="28%" height={13} /><Skeleton width="15%" height={13} /><Skeleton width="12%" height={13} /><Skeleton width="10%" height={13} /></div>)}</div></div>
  </div>;
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <span className="spinner" /> <span style={{ marginLeft: 8 }}>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="state">
      <div className="alert" style={{ textAlign: 'left' }}>{message}</div>
      {onRetry && (
        <button className="ghost small" style={{ marginTop: 12 }} onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

export function Empty({ label }: { label: string }) {
  return <div className="state">{label}</div>;
}

export function Drawer({ title, onClose, children }: {
  title: string; onClose: () => void; children: ReactNode;
}) {
  return (
    <div
      className="drawer-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <aside className="drawer" onClick={(event) => event.stopPropagation()}>
        <div className="spread">
          <h1>{title}</h1>
          <button className="ghost small" onClick={onClose}>Close</button>
        </div>
        {children}
      </aside>
    </div>
  );
}

export function Modal({ title, onClose, children }: {
  title: string; onClose: () => void; children: ReactNode;
}) {
  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="spread">
          <h1>{title}</h1>
          <button className="ghost small" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
