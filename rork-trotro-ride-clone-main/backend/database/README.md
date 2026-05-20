# Database

PostgreSQL schema for the Trotro backend. Compatible with any vanilla Postgres
instance (local, Docker, RDS, Neon, Supabase, etc.).

## Layout

```
database/
  migrations/       Numbered, append-only SQL files run in lexical order
  seeds/            Idempotent reference-data SQL (ON CONFLICT DO NOTHING)
  migrate.js        Migration runner (tracks history in schema_migrations)
  seed.js           Seed runner
```

## Configure

Set `DATABASE_URL` in `backend/.env` (see `.env.example`).
For Supabase use the **Transaction pooler** URI on port `6543` and set `PGSSL=true`.

## Run

```bash
# from repo root
npm --prefix backend install
npm --prefix backend run db:migrate
npm --prefix backend run db:seed   # optional reference data
```

## Adding a migration

1. Create `database/migrations/NNN_short_description.sql` (next free number).
2. Use `create table if not exists`, `do $$ ... exception when duplicate_object`
   for enums, and `create index if not exists` so re-runs are safe.
3. Re-run `npm run db:migrate` — already-applied files are skipped via
   `public.schema_migrations`.

## Schema overview

| Domain        | Tables |
| ------------- | ------ |
| Auth          | `users`, `profiles` |
| Network       | `bus_stops`, `routes`, `route_stops` |
| Fleet         | `drivers`, `buses` |
| Trips         | `bookings`, `verification_codes` |
| Alerts        | `bus_alerts` |
| Payments      | `wallets`, `wallet_transactions` |
| Feedback      | `driver_ratings` |
| Ops / Config  | `stop_demand`, `scheduling_rules` |
| Meta          | `schema_migrations` |

Triggers keep `updated_at` columns fresh and auto-create a wallet row whenever
a profile is inserted.
