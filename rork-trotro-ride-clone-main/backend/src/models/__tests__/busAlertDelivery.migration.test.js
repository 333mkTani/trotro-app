const fs = require('fs');
const path = require('path');

describe('bus alert delivery migration', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../../../database/migrations/026_bus_alert_delivery.sql'), 'utf8',
  );
  const rollback = fs.readFileSync(
    path.join(__dirname, '../../../database/rollbacks/026_bus_alert_delivery.sql'), 'utf8',
  );

  it('enforces one trigger per alert local day and one delivery per recipient', () => {
    expect(migration).toContain('unique (alert_id, local_date)');
    expect(migration).toContain('unique (trigger_occurrence_id, recipient_id)');
    expect(migration).toContain('bus_alert_in_app_notifications');
  });

  it('has an explicit rollback', () => {
    expect(rollback).toContain('drop table if exists public.bus_alert_notification_jobs');
    expect(rollback).toContain('drop column if exists timezone');
  });
});
