const fs = require('fs');
const path = require('path');

describe('migration 024 boarding lifecycle contract', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../../../database/migrations/024_schedule_boarding_lifecycle.sql'), 'utf8');
  const rollback = fs.readFileSync(path.join(__dirname, '../../../database/rollbacks/024_schedule_boarding_lifecycle.sql'), 'utf8');

  it('links at most one ordinary booking to an occurrence', () => {
    expect(migration).toContain('source_occurrence_id uuid unique');
    expect(migration).toContain('references public.schedule_occurrences(id)');
  });

  it('creates one time-bounded code per occurrence', () => {
    expect(migration).toContain('occurrence_id  uuid not null unique');
    expect(migration).toContain("status in ('active','used','expired','cancelled')");
    expect(migration).toContain('check (valid_until > valid_from)');
  });

  it('records each no-show once for later policy enforcement', () => {
    expect(migration).toContain('schedule_no_shows');
    expect(migration).toContain('occurrence_id  uuid not null unique');
  });

  it('reverses every schema addition', () => {
    expect(rollback).toContain('drop table if exists public.schedule_no_shows');
    expect(rollback).toContain('drop table if exists public.schedule_boarding_codes');
    expect(rollback).toContain('drop column if exists source_occurrence_id');
  });
});
