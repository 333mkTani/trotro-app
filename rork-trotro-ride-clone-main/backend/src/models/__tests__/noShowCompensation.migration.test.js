const fs = require('fs');
const path = require('path');

describe('no-show compensation migration', () => {
  const enums = fs.readFileSync(
    path.join(__dirname, '../../../database/migrations/041_no_show_driver_compensation.sql'), 'utf8',
  );
  const sql = fs.readFileSync(
    path.join(__dirname, '../../../database/migrations/042_no_show_compensation_schema.sql'), 'utf8',
  );

  it('adds GPS evidence and compensation audit fields', () => {
    expect(sql).toContain('driver_pickup_arrived_at timestamptz');
    expect(sql).toContain('no_show_compensation_amount numeric(10,2)');
    expect(sql).toContain('no_show_compensated_at timestamptz');
    expect(enums).toContain("'deposit_forfeited'");
    expect(enums).toContain("'no_show_compensation'");
  });

  it('enforces one payment and wallet compensation per booking', () => {
    expect(sql).toContain('booking_payments_one_no_show_compensation_uidx');
    expect(sql).toContain('wallet_transactions_one_no_show_compensation_uidx');
  });
});
