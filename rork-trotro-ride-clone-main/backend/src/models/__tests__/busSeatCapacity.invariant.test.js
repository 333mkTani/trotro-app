const fs = require('fs');
const path = require('path');

describe('bus seat capacity invariant', () => {
  it('repairs existing values and enforces available seats within total capacity', () => {
    const sql = fs.readFileSync(
      path.join(__dirname, '../../../database/migrations/031_bus_seat_capacity_invariant.sql'),
      'utf8',
    );
    expect(sql).toContain('least(greatest(seats_available, 0), total_seats)');
    expect(sql).toContain('seats_available between 0 and total_seats');
  });

  it('clamps atomic seat releases at total capacity', () => {
    const source = fs.readFileSync(path.join(__dirname, '../bus.model.js'), 'utf8');
    expect(source).toContain('least(total_seats, greatest(0, seats_available + $1))');
  });
});

