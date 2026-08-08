const fs = require('fs');
const path = require('path');

describe('bus alert dead-letter migration', () => {
  const migrations = path.join(__dirname, '../../../database/migrations');
  const rollbacks = path.join(__dirname, '../../../database/rollbacks');
  it('adds dead-letter status and an operations index', () => {
    const sql = fs.readFileSync(path.join(migrations, '029_bus_alert_dead_letter.sql'), 'utf8');
    expect(sql).toContain("'dead_letter'");
    expect(sql).toContain('bus_alert_notification_jobs_dead_letter_idx');
  });
  it('reconciles dead letters before rollback', () => {
    const sql = fs.readFileSync(path.join(rollbacks, '029_bus_alert_dead_letter.sql'), 'utf8');
    expect(sql).toContain("set status = 'cancelled' where status = 'dead_letter'");
  });
});
