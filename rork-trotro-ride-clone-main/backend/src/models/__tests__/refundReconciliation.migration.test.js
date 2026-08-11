const fs = require('fs');
const path = require('path');

describe('refund reconciliation migration', () => {
  const sql = fs.readFileSync(path.join(
    __dirname, '../../../database/migrations/043_refund_reconciliation.sql',
  ), 'utf8');
  it('links one active refund to its original payment', () => {
    expect(sql).toContain('parent_payment_id uuid references public.booking_payments');
    expect(sql).toContain('booking_payments_one_active_refund_uidx');
  });
  it('stores idempotent provider reconciliation events', () => {
    expect(sql).toContain('payment_reconciliation_events');
    expect(sql).toContain('unique (provider, event_key)');
  });
});
