const fs = require('fs');
const path = require('path');

describe('bus alert integrity migration', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../../../database/migrations/027_bus_alert_integrity.sql'), 'utf8',
  );
  const rollback = fs.readFileSync(
    path.join(__dirname, '../../../database/rollbacks/027_bus_alert_integrity.sql'), 'utf8',
  );

  it('enforces configuration and route-stop integrity', () => {
    expect(migration).toContain('bus_alerts_active_configuration_check');
    expect(migration).toContain('bus_alert_validate_route_stop');
    expect(migration).toContain('bus_alerts_due_one_time_idx');
    expect(migration).toContain('bus_alerts_due_recurring_idx');
  });

  it('removes every added constraint and trigger on rollback', () => {
    expect(rollback).toContain('drop trigger if exists trg_bus_alert_validate_route_stop');
    expect(rollback).toContain('drop constraint if exists bus_alerts_active_configuration_check');
  });
});
