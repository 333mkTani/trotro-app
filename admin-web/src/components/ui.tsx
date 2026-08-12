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

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state">
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
