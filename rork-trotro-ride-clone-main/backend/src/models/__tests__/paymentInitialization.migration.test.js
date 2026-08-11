const fs = require('fs');
const path = require('path');

describe('migration 038 payment initialization', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../../../database/migrations/038_payment_initialization.sql'), 'utf8',
  );
  const rollback = fs.readFileSync(
    path.join(__dirname, '../../../database/rollbacks/038_payment_initialization.sql'), 'utf8',
  );

  it('persists the checkout details needed for idempotent retries', () => {
    expect(migration).toContain('authorization_url text');
    expect(migration).toContain('access_code text');
    expect(migration).toContain('provider_channel text');
  });

  it('allows only one active deposit per booking', () => {
    expect(migration).toContain('booking_payments_one_active_deposit_uidx');
    expect(migration).toContain("type = 'deposit' and status in ('initiated', 'pending', 'succeeded')");
  });

  it('is reversible', () => {
    expect(rollback).toContain('drop index if exists public.booking_payments_one_active_deposit_uidx');
    expect(rollback).toContain('drop column if exists authorization_url');
  });
});
