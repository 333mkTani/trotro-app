const fs = require('fs');
const path = require('path');

describe('booking cancellation and expiry migration', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../../../database/migrations/040_booking_cancellation_expiry.sql'),
    'utf8',
  );

  it('indexes provisional holds and unboarded booking deadlines', () => {
    expect(migration).toContain('bookings_due_provisional_holds_idx');
    expect(migration).toContain("status = 'pending' and payment_status = 'deposit_pending'");
    expect(migration).toContain('bookings_due_boarding_idx');
    expect(migration).toContain("status = 'confirmed' and boarded_at is null");
  });
});
