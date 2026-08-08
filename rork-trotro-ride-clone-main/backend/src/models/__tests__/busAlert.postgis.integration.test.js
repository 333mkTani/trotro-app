const databaseUrl = process.env.BUS_ALERT_INTEGRATION_DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
const { query, pool } = require('../../config/db');
const integration = databaseUrl ? describe : describe.skip;

integration('bus alert real PostgreSQL/PostGIS integration', () => {
  beforeAll(async () => {
    const { rows } = await query(`select extversion from pg_extension where extname = 'postgis'`);
    if (!rows[0]) throw new Error('BUS_ALERT_INTEGRATION_DATABASE_URL must point to a migrated PostGIS database');
  });

  afterAll(async () => pool.end());

  it('includes buses immediately inside and excludes buses immediately outside the proximity boundary', async () => {
    const { rows } = await query(`select
      ST_DWithin(ST_SetSRID(ST_MakePoint(0, 0),4326)::geography,
                 ST_Project(ST_SetSRID(ST_MakePoint(0, 0),4326)::geography, 2999, 0), 3000) as inside,
      ST_DWithin(ST_SetSRID(ST_MakePoint(0, 0),4326)::geography,
                 ST_Project(ST_SetSRID(ST_MakePoint(0, 0),4326)::geography, 3001, 0), 3000) as outside`);
    expect(rows[0]).toEqual({ inside: true, outside: false });
  });

  it('enforces one trigger occurrence per alert and local date', async () => {
    const { rows } = await query(`select count(*)::int as unique_constraints
      from pg_constraint where conrelid = 'public.bus_alert_trigger_occurrences'::regclass
      and contype = 'u' and pg_get_constraintdef(oid) like '%alert_id, local_date%'`);
    expect(rows[0].unique_constraints).toBe(1);
  });
});
