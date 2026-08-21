const fs = require('fs');
const path = require('path');

describe('seat_released_at migration', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../../../database/migrations/049_seat_released_at.sql'),
    'utf8',
  );

  it('adds an auditable timestamp and prevents it on non-terminal bookings', () => {
    expect(migration).toMatch(/add column if not exists seat_released_at timestamptz/i);
    expect(migration).toMatch(/seat_released_at is null or status in \('cancelled', 'expired', 'completed'\)/i);
  });

  it('creates an audit index for released seats', () => {
    expect(migration).toMatch(/bookings_seat_release_audit_idx/i);
    expect(migration).toMatch(/where seat_released_at is not null/i);
  });
});
