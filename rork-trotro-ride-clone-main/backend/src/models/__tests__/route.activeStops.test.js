jest.mock('../../config/db', () => ({ query: jest.fn() }));

const { query } = require('../../config/db');
const routeModel = require('../route.model');

describe('route active-stop integrity', () => {
  beforeEach(() => jest.clearAllMocks());

  it('builds route sequences only from active stop records', async () => {
    query.mockResolvedValue({ rows: [] });
    await routeModel.list({ status: 'active', city: 'kumasi' });
    const sql = query.mock.calls[0][0];
    expect(sql).toContain("s.status = 'active'");
    expect(sql).toContain('array_agg(s.id::text');
  });

  it('omits inactive stops from route details', async () => {
    query.mockResolvedValue({ rows: [] });
    await routeModel.findStops('route-1');
    expect(query.mock.calls[0][0]).toContain("s.status = 'active'");
  });
});
