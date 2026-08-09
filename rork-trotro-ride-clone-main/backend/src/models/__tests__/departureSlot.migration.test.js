const fs = require('fs');
const path = require('path');

describe('driver departure-slot migration', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../../../database/migrations/030_driver_departure_slots.sql'), 'utf8');
  const rollback = fs.readFileSync(path.join(__dirname, '../../../database/rollbacks/030_driver_departure_slots.sql'), 'utf8');

  it('adds published slots and a commuter schedule reference', () => {
    expect(migration).toContain('create table if not exists public.driver_departure_slots');
    expect(migration).toContain('add column if not exists departure_slot_id');
    expect(migration).toContain('driver_departure_slots_unique_active_idx');
  });

  it('provides a reversible rollback', () => {
    expect(rollback).toContain('drop column if exists departure_slot_id');
    expect(rollback).toContain('drop table if exists public.driver_departure_slots');
  });
});
