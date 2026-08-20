# Fresh database migration validation

Issue #24 is validated through the canonical migration runner at `backend/database/migrate.js`. The backend package command `npm run migrate`, the local Compose migration tool, and the Render staging `preDeployCommand` all use this same runner and record applied files in `public.schema_migrations`. The former `src/migrate.js` entrypoint remains only as a compatibility wrapper, so there is one migration ledger and one execution path.

## Fresh database procedure

Create an empty PostgreSQL 16 database with PostGIS available, set `DATABASE_URL` and `PGSSL`, and run the migration command from the backend directory:

```bash
cd rork-trotro-ride-clone-main/backend
DATABASE_URL=postgresql://... PGSSL=true npm run migrate
DATABASE_URL=postgresql://... PGSSL=true npm run verify:database
```

For local validation, the repository’s Compose stack uses `postgis/postgis:16-3.4-alpine`. The tools profile applies the migration files and the repository’s reference seed. The verification command is non-destructive: it reads the schema and seed data, and tests the seat check constraint through a transaction/savepoint that is rolled back.

```bash
cd rork-trotro-ride-clone-main/backend
docker compose up -d db redis
docker compose --profile tools run --rm migrate
docker compose --profile tools run --rm seed
DATABASE_URL=postgresql://postgres:password@localhost:5432/trotro \
PGSSL=false npm run verify:database
```

The command expects a fresh database to have all migration files recorded. It fails if a migration is missing, extra, out of order, or if a required table, extension, index, constraint, or seed record is absent.

## Assertions performed

| Area | Verification |
|---|---|
| Migration completeness | Every SQL file in `database/migrations/` appears exactly once in `public.schema_migrations`, in lexical order. |
| PostGIS | The `postgis` extension exists, seeded stop geometry exists, and a stop is within one metre of its synchronized `lat/lng` geometry using `ST_DWithin`. |
| Spatial indexes | `bus_stops_geom_idx` and `buses_geom_idx` exist. |
| Route stops | `route_stops` exists with primary-key and route/stop uniqueness constraints; seeded routes contain more than one stop with strictly increasing sequence values. |
| Seat capacity | Every seeded bus has `0 <= seats_available <= total_seats`, and an attempted over-capacity update is rejected by `buses_seat_capacity_check` inside a rolled-back probe. |
| Cleanup readiness | The due-hold and due-boarding indexes from migration 040 exist for deterministic cleanup queries. |

The verification script does not claim to replace concurrent transaction tests. Those should run against a real database in issue #28, where the last-seat race, duplicate callbacks, and worker-restart behavior are tested with multiple sessions.

## Migration safety rules

Each migration runs inside a transaction and is recorded only after its SQL succeeds. Re-running the command skips files already present in `public.schema_migrations`. Before applying a migration to staging or production, take a database backup or snapshot, record the current migration ledger, and confirm that the migration is forward-compatible with the deployed application version.

The fresh-database check must run against an isolated database. Do not point it at production and do not add a destructive database reset command to the application scripts. If a migration fails, preserve the database and logs for diagnosis rather than deleting the partial environment.
