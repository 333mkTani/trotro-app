const fs = require('fs');
const path = require('path');

describe('migration 037 provisional booking holds', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../../../database/migrations/037_provisional_booking_holds.sql'),
    'utf8',
  );
  const rollback = fs.readFileSync(
    path.join(__dirname, '../../../database/rollbacks/037_provisional_booking_holds.sql'),
    'utf8',
  );

  it('adds an expiry to payment-pending seat holds', () => {
    expect(migration).toContain('hold_expires_at timestamptz');
    expect(migration).toContain("payment_status <> 'deposit_pending'");
  });

  it('indexes only active provisional holds', () => {
    expect(migration).toContain('bookings_active_provisional_holds_idx');
    expect(migration).toContain("status = 'pending' and payment_status = 'deposit_pending'");
  });

  it('is reversible', () => {
    expect(rollback).toContain('drop column if exists hold_expires_at');
  });
});
