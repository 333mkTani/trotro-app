const fs = require('fs');
const path = require('path');

describe('migration 039 balance collection', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../../../database/migrations/039_balance_collection.sql'), 'utf8',
  );
  const rollback = fs.readFileSync(
    path.join(__dirname, '../../../database/rollbacks/039_balance_collection.sql'), 'utf8',
  );

  it('permits only one active balance transaction for a booking', () => {
    expect(migration).toContain('booking_payments_one_active_balance_uidx');
    expect(migration).toContain("type = 'balance' and status in ('initiated', 'pending', 'succeeded')");
  });

  it('is reversible', () => {
    expect(rollback).toContain('drop index if exists public.booking_payments_one_active_balance_uidx');
  });
});
