# Staging recovery drills

Issue #34 adds `npm run verify:recovery`, a guarded preflight and evidence generator for staging recovery exercises. It refuses to proceed unless `RECOVERY_ENV=staging` and `RECOVERY_CONFIRM=I_UNDERSTAND_STAGING_RECOVERY` are set, and it rejects the production API hostname. It never prints database URLs, credentials, tokens, or provider payloads.

## Drill sequence

| Step | Action | Success evidence |
|---|---|---|
| 1 | Capture a timestamped custom-format `pg_dump` from staging. | Backup path, size, checksum, source commit, migration version, and owner. |
| 2 | Restore into a separate disposable staging database. Never restore over the source database. | `pg_restore` exit status and isolated target connection. |
| 3 | Apply or verify migrations and reference seed data. | `schema_migrations` equality, PostGIS availability, critical row-count comparison, and `verify:database` output. |
| 4 | Run the signed Paystack test webhook replay harness. | Sanitized webhook response, idempotency result, and no duplicate ledger effect. |
| 5 | Restart the schedule worker. | Worker shutdown timestamp, restart timestamp, successful cycle, and advisory-lock evidence. |
| 6 | Verify API and dependency health. | `/health`, `/ready`, Redis state, and metrics snapshot. |
| 7 | Exercise realtime reconnect. | Socket reconnect timestamp, resubscription result, and disconnect ratio. |
| 8 | Record rollback decision and incident timeline. | Render deploy ID, commit, rollback owner, communication time, and post-rollback health. |

## Preflight and evidence command

From the backend directory:

```bash
RECOVERY_ENV=staging \
RECOVERY_CONFIRM=I_UNDERSTAND_STAGING_RECOVERY \
DATABASE_URL=postgresql://... \
RECOVERY_BACKUP_DIR=/secure/staging-recovery-evidence \
npm run verify:recovery
```

The verifier checks that `pg_dump`, `pg_restore`, and `psql` are installed and emits a sanitized drill checklist. Set `RECOVERY_EXECUTE=true` only after the staging owner has confirmed the source and disposable restore target. The repository script intentionally does not execute a destructive restore automatically; the operator must provide a separate restore database and run the approved command:

```bash
pg_dump --format=custom --no-owner --file=/secure/staging-recovery-evidence/staging.dump "$DATABASE_URL"
pg_restore --clean --if-exists --no-owner --dbname="$RECOVERY_DATABASE_URL" /secure/staging-recovery-evidence/staging.dump
npm run verify:database
```

## Rollback and incident recovery

Application rollback uses the last known-good Render deploy for the API, worker, and admin services. Database rollback is not an automatic companion to application rollback: after migrations are applied, use a reviewed forward fix or restore only into an isolated recovery target unless the incident commander and database owner approve a production restore. Capture the deployed commit and migration ledger before any rollback.

A drill is complete only when the restored target answers readiness checks, migrations and critical invariants pass, duplicate webhook delivery remains idempotent, the worker reacquires its advisory lock after restart, realtime clients reconnect, and no secret or personal data appears in the evidence bundle.

## References

[1]: https://www.postgresql.org/docs/current/backup-dump.html "PostgreSQL SQL dump documentation"

[2]: https://www.postgresql.org/docs/current/app-pgrestore.html "PostgreSQL pg_restore documentation"

[3]: https://render.com/docs/deploys "Render deploy and rollback documentation"
