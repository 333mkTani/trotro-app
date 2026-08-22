# CI database release gate

The backend database workflow provisions a disposable PostGIS 16 database, applies every migration to a fresh schema, verifies database invariants, replays migrations for idempotency, and runs the real PostgreSQL sync integration suite.

## Seeded integration coverage

The integration runner creates deterministic driver, passenger, bus, and route fixtures. It verifies route-stop ordering and PostGIS proximity, concurrent last-seat reservation, duplicate sync mutation handling, GPS persistence, sync retention, and transaction rollback.

It also seeds terminal and non-terminal booking states. The suite verifies that cancelled and completed bookings receive exactly one seat release and `seat_released_at` timestamp, duplicate release attempts do not increase inventory again, and a boarded ride in recovery review remains confirmed with its seat retained. It checks that the database rejects a seat-release timestamp on a non-terminal booking.

## Backup and restore

After integration checks, CI creates a custom-format `pg_dump`, restores it into a second disposable database, verifies PostGIS availability, checks the migration ledger, and confirms that booking rows are present after restore. The restore log and failed dump artifact are uploaded for diagnosis.

The restore step is intentionally isolated from staging and production. It uses only the GitHub Actions PostgreSQL service and CI credentials.

## Release-gate interpretation

A failed migration replay, spatial assertion, booking-state invariant, seat-release check, sync race, rollback check, or restore verification blocks the database job. Integration and restore logs are retained as workflow artifacts when a run fails, allowing operators to diagnose the database state without accessing production data.
