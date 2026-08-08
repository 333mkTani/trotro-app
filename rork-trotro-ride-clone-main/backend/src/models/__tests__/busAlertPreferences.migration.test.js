const fs = require('fs');
const path = require('path');

describe('bus alert preferences migration', () => {
  const migrations = path.join(__dirname, '../../../database/migrations');
  const rollbacks = path.join(__dirname, '../../../database/rollbacks');

  it('adds a default-on server delivery preference', () => {
    const sql = fs.readFileSync(path.join(migrations, '028_bus_alert_preferences.sql'), 'utf8');
    expect(sql).toContain('bus_alerts_enabled boolean not null default true');
  });

  it('has a rollback', () => {
    const sql = fs.readFileSync(path.join(rollbacks, '028_bus_alert_preferences.sql'), 'utf8');
    expect(sql).toContain('drop column if exists bus_alerts_enabled');
  });
});
