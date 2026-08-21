# Follow-up engineering plan

This register records work that is intentionally not compressed into a one-line patch. The quick hardening changes are implemented separately so each larger change can be designed, tested, and rolled out safely.

## Sync retention

The backend now includes a configurable `worker:sync-retention` process. It uses a single transaction to delete expired `sync_changes` and completed `sync_mutations`, defaults to 90 days, and excludes mutations still in `processing`. Staging and production must set `SYNC_RETENTION_DAYS` after privacy and legal approval, and the worker must be deployed as a separate operational process.

## Atomic sync reserve–apply–mark processing

The current sync service reserves a receipt transactionally, applies driver mutations through services that currently use the shared pool, and marks the receipt afterward. Converting that sequence to one database transaction requires client-aware model/service methods, transaction-safe realtime side effects, idempotent external notifications, and explicit recovery behavior when a transaction is interrupted. This is a separate reliability project and must include concurrent-driver tests.

## CI database suite

`.github/workflows/backend-database.yml` provisions PostGIS, applies migrations to a fresh database, verifies database invariants, reruns migrations for idempotency, and executes the backend test suite. It should be extended with seed data, spatial-query assertions, booking-lock races, sync retention checks, and a disposable restore test before becoming a mandatory merge gate.

## Parked lifecycle and settlement work

The following items remain separately tracked because they change financial or booking invariants: boarded-ride recovery lifecycle, driver settlement on the deposit path, `seat_released_at`, and the complete-transaction lock. Each requires a state-transition specification, migration/backfill plan, concurrency tests, and operational reconciliation evidence before release.

## Operational requirements

The migration rename from `045_profile_account_deletion.sql` to `046_profile_account_deletion.sql` is safe only before the old filename is recorded in an environment. If the old migration has already run in staging or production, preserve the recorded migration history and use a compatibility migration rather than replaying it under a new filename.
