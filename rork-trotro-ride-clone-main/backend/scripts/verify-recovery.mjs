#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const env = process.env;
const baseURL = String(env.RECOVERY_BASE_URL || '').replace(/\/$/, '');
const failures = [];
const check = (ok, message) => {
  if (ok) console.log(`PASS ${message}`);
  else { console.error(`FAIL ${message}`); failures.push(message); }
};

check(env.RECOVERY_ENV === 'staging', 'RECOVERY_ENV=staging safety gate');
check(env.RECOVERY_CONFIRM === 'I_UNDERSTAND_STAGING_RECOVERY', 'explicit staging recovery confirmation');
check(Boolean(env.DATABASE_URL), 'source DATABASE_URL is configured');
check(Boolean(env.RECOVERY_BACKUP_DIR), 'RECOVERY_BACKUP_DIR is configured');
if (baseURL) {
  try {
    const host = new URL(baseURL).hostname.toLowerCase();
    check(host !== 'trotro-api.onrender.com', 'production API host rejected');
    check(/^https:\/\//i.test(baseURL) || env.RECOVERY_ALLOW_HTTP === 'true', 'recovery API uses HTTPS');
  } catch { check(false, 'RECOVERY_BASE_URL is a valid URL'); }
}

for (const binary of ['pg_dump', 'pg_restore', 'psql']) {
  try { execFileSync(binary, ['--version'], { stdio: 'ignore' }); check(true, `${binary} is installed`); }
  catch { check(false, `${binary} is installed`); }
}

const report = {
  drillId: `recovery-${new Date().toISOString().replace(/[:.]/g, '-')}-${os.hostname()}`,
  environment: env.RECOVERY_ENV || 'unset',
  backupDirectory: env.RECOVERY_BACKUP_DIR || null,
  executeMode: env.RECOVERY_EXECUTE === 'true',
  steps: [
    'Capture a timestamped pg_dump custom-format backup from staging.',
    'Restore into a separate disposable staging database, never over the source database.',
    'Run migrations/seed verification and compare migration ledger plus critical row counts.',
    'Run the signed webhook replay harness with a Paystack test fixture.',
    'Restart the worker and verify the next cycle acquires the advisory lock and completes.',
    'Verify API /ready, Redis health, realtime reconnect, and sanitized logs.',
    'Record backup path, restore target, commit, migration version, worker restart timestamps, and owner.',
  ],
};

if (env.RECOVERY_EXECUTE === 'true' && failures.length === 0) {
  const dir = path.resolve(env.RECOVERY_BACKUP_DIR);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const output = path.join(dir, `${report.drillId}.json`);
  fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(`WROTE ${output}`);
} else {
  console.log(JSON.stringify(report, null, 2));
}

if (failures.length) process.exitCode = 1;
