const fs = require('fs');
const path = require('path');

describe('migration 036 booking payment ledger contract', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../../../database/migrations/036_booking_payment_ledger.sql'),
    'utf8'
  );
  const rollback = fs.readFileSync(
    path.join(__dirname, '../../../database/rollbacks/036_booking_payment_ledger.sql'),
    'utf8'
  );

  it('adds explicit reservation payment lifecycle states', () => {
    expect(migration).toContain('create type reservation_payment_status');
    expect(migration).toContain("'deposit_pending'");
    expect(migration).toContain("'deposit_paid'");
    expect(migration).toContain("'balance_pending'");
    expect(migration).toContain("'fully_paid'");
    expect(migration).toContain("'refund_pending'");
    expect(migration).toContain("'refunded'");
  });

  it('tracks deposit, balance, cancellation and no-show data for both journeys', () => {
    expect(migration).toContain('alter table public.bookings');
    expect(migration).toContain('alter table public.schedule_occurrences');
    expect(migration).toContain('deposit_amount numeric(10,2)');
    expect(migration).toContain('remaining_balance numeric(10,2)');
    expect(migration).toContain('cancellation_deadline timestamptz');
    expect(migration).toContain('no_show_marked_at timestamptz');
  });

  it('requires every ledger entry to target exactly one journey', () => {
    expect(migration).toContain('create table if not exists public.booking_payments');
    expect(migration).toContain('(booking_id is not null)::integer + (occurrence_id is not null)::integer = 1');
  });

  it('prevents duplicate client requests and provider confirmations', () => {
    expect(migration).toContain('idempotency_key       text not null unique');
    expect(migration).toContain('booking_payments_provider_reference_uidx');
  });

  it('uses positive, currency-labelled ledger amounts', () => {
    expect(migration).toContain('amount                numeric(10,2) not null check (amount > 0)');
    expect(migration).toContain("currency              char(3) not null default 'GHS'");
  });

  it('rolls back the ledger, columns and enum types', () => {
    expect(rollback).toContain('drop table if exists public.booking_payments');
    expect(rollback).toContain('drop column if exists payment_status');
    expect(rollback).toContain('drop type if exists reservation_payment_status');
  });
});
