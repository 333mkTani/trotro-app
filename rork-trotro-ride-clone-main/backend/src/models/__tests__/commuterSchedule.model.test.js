const fs = require('fs');
const path = require('path');

jest.mock('../../config/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

const db = require('../../config/db');
const scheduleModel = require('../commuterSchedule.model');
const occurrenceModel = require('../scheduleOccurrence.model');

describe('recurring schedule persistence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('inserts recurring preferences separately from ordinary bookings', async () => {
    db.query.mockResolvedValue({ rows: [{ id: 'schedule-1' }] });
    await scheduleModel.insert('passenger-1', {
      routeId: 'route-1', departureStopId: 'station-1', destinationStopId: 'station-2',
      travelDays: ['mon', 'wed'], boardingStartLocal: '06:00', boardingEndLocal: '06:20',
      timezone: 'Africa/Accra', primaryDeadlineLocal: '20:00', backupMatchingEnabled: true,
    });
    const [sql, values] = db.query.mock.calls[0];
    expect(sql).toContain('insert into public.commuter_schedules');
    expect(sql).not.toContain('bookings');
    expect(values).toContainEqual(['mon', 'wed']);
  });

  it('generates an occurrence idempotently for one schedule and service date', async () => {
    db.query.mockResolvedValue({ rows: [] });
    await occurrenceModel.insert({
      scheduleId: 'schedule-1', passengerId: 'passenger-1', serviceDate: '2026-08-10',
      boardingStartAt: new Date(), boardingEndAt: new Date(), primaryDeadline: new Date(),
      finalDeadline: new Date(), boardingOpensAt: new Date(),
    });
    expect(db.query.mock.calls[0][0]).toContain('on conflict (schedule_id, service_date) do nothing');
  });
});

describe('migration 023 contract', () => {
  const migration = fs.readFileSync(path.join(__dirname, '../../../database/migrations/023_commuter_schedules.sql'), 'utf8');
  const rollback = fs.readFileSync(path.join(__dirname, '../../../database/rollbacks/023_commuter_schedules.sql'), 'utf8');

  it.each(['commuter_schedules', 'schedule_occurrences', 'driver_schedule_responses', 'future_reservations'])(
    'creates and reverses %s', (table) => {
      expect(migration).toMatch(new RegExp(`create table if not exists public\\.${table}`));
      expect(rollback).toMatch(new RegExp(`drop table if exists public\\.${table}`));
    },
  );

  it('enforces occurrence uniqueness and exactly one accepted response', () => {
    expect(migration).toContain('unique (schedule_id, service_date)');
    expect(migration).toContain("where response = 'accepted'");
    expect(migration).toContain('(assigned_driver_id is null) = (assigned_bus_id is null)');
    expect(migration).toContain('occurrence_id   uuid not null unique');
  });

  it('keeps the rollback outside the forward migration directory', () => {
    expect(path.dirname(path.join(__dirname, '../../../database/rollbacks/023_commuter_schedules.sql')))
      .not.toBe(path.join(__dirname, '../../../database/migrations'));
  });
});
