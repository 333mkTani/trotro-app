jest.mock('../../config/db', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

const db = require('../../config/db');
const occurrenceModel = require('../scheduleOccurrence.model');

describe('driver scheduled occurrence visibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.query.mockResolvedValue({ rows: [] });
  });

  it('returns passenger, route and backup-matching details', async () => {
    await occurrenceModel.listForDriver('driver-1');
    const [sql] = db.query.mock.calls[0];

    expect(sql).toContain('s.backup_matching_enabled');
    expect(sql).toContain('rte.name as route_name');
    expect(sql).toContain('p.full_name as passenger_name');
    expect(sql).toContain('join public.routes rte on rte.id = s.route_id');
    expect(sql).toContain('join public.profiles p on p.id = o.passenger_id');
  });

  it('expires only unassigned open offers at the response deadline', async () => {
    await occurrenceModel.listForDriver('driver-1');
    const [sql, values] = db.query.mock.calls[0];

    expect(sql).toMatch(/o\.status in \('pending','offered'\)[\s\S]*o\.assigned_driver_id is null[\s\S]*o\.final_acceptance_deadline > now\(\)/);
    expect(values).toEqual(['driver-1']);
  });

  it('hides an open offer after this driver declines it', async () => {
    await occurrenceModel.listForDriver('driver-1');
    const [sql] = db.query.mock.calls[0];
    expect(sql).toContain("r.response is distinct from 'declined'");
  });

  it('shows an open offer before the final deadline and hides it after expiry', async () => {
    await occurrenceModel.listForDriver('driver-1');
    const [sql] = db.query.mock.calls[0];
    expect(sql).toMatch(/o\.status in \('pending','offered'\)[\s\S]*o\.final_acceptance_deadline > now\(\)/);
    expect(sql).not.toContain('o.final_acceptance_deadline <= now()');
  });

  it('keeps the assigned driver\'s accepted trip visible through boarding', async () => {
    await occurrenceModel.listForDriver('driver-1');
    const [sql] = db.query.mock.calls[0];

    expect(sql).toMatch(/o\.status in \('accepted','boarding_open','boarded'\)[\s\S]*o\.assigned_driver_id = \$1[\s\S]*o\.boarding_end_at > now\(\)/);
    expect(sql).not.toMatch(/o\.status in \('accepted','boarding_open','boarded'\)[\s\S]*o\.final_acceptance_deadline > now\(\)/);
  });

  it('never exposes an accepted trip to an unassigned driver', async () => {
    await occurrenceModel.listForDriver('driver-2');
    const [sql, values] = db.query.mock.calls[0];
    expect(sql).toMatch(/o\.status in \('accepted','boarding_open','boarded'\)[\s\S]*o\.assigned_driver_id = \$1/);
    expect(values).toEqual(['driver-2']);
  });

  it('scopes detail to a live same-route offer or the assigned driver', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'occ-1' }] });
    await occurrenceModel.findForDriver('occ-1', 'driver-1');
    const [sql, values] = db.query.mock.calls[0];

    expect(values).toEqual(['occ-1', 'driver-1']);
    expect(sql).toContain('o.assigned_driver_id = $2');
    expect(sql).toMatch(/o\.status in \('pending','offered'\)[\s\S]*o\.final_acceptance_deadline > now\(\)[\s\S]*eb\.id is not null/);
    expect(sql).toContain("b.driver_id = $2 and b.route_id = s.route_id");
    expect(sql).toContain("resp.response is distinct from 'declined'");
  });

  it('limits terminal history to assigned or responding drivers', async () => {
    await occurrenceModel.listHistoryForDriver('driver-1');
    const [sql, values] = db.query.mock.calls[0];

    expect(sql).toContain("o.status in ('unmatched','cancelled','expired','departed','completed')");
    expect(sql).toContain('(o.assigned_driver_id = $1 or resp.driver_id = $1)');
    expect(sql).toContain('order by o.boarding_start_at desc');
    expect(sql).toContain('limit $2');
    expect(values).toEqual(['driver-1', 50]);
  });
});
