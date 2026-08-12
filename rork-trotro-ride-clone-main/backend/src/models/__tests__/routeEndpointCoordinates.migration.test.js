const fs = require('fs');
const path = require('path');

describe('route endpoint-coordinate migration', () => {
  const migration = fs.readFileSync(
    path.join(__dirname, '../../../database/migrations/044_route_endpoint_coordinates.sql'),
    'utf8',
  );
  const rollback = fs.readFileSync(
    path.join(__dirname, '../../../database/rollbacks/044_route_endpoint_coordinates.sql'),
    'utf8',
  );

  it('adds and backfills both route endpoints with valid coordinate constraints', () => {
    expect(migration).toContain('add column if not exists origin_lat');
    expect(migration).toContain('add column if not exists destination_lng');
    expect(migration).toContain('order by rs.sequence asc limit 1');
    expect(migration).toContain('order by rs.sequence desc limit 1');
    expect(migration).toContain('routes_destination_lng_check');
  });

  it('provides a reversible rollback', () => {
    expect(rollback).toContain('drop column if exists origin_lat');
    expect(rollback).toContain('drop column if exists destination_lng');
  });
});
