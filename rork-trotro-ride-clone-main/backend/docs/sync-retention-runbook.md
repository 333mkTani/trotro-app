# Sync retention production runbook

## Approved policy

The production policy retains synchronization history for **90 days**. The cleanup removes `sync_changes` older than the cutoff and removes only non-`processing` rows from `sync_mutations` whose `processed_at` is older than the cutoff. Both deletes run in one database transaction. In-flight mutations are never eligible for deletion.

## Worker configuration

Deploy a dedicated Render background worker from the backend service with the start command:

```bash
npm run worker:sync-retention
```

Set the following environment variables on the worker. The worker must use the same production `DATABASE_URL` as the API.

| Variable | Value |
|---|---:|
| `NODE_ENV` | `production` |
| `SYNC_RETENTION_DAYS` | `90` |
| `SYNC_RETENTION_RUN_AT_UTC` | `02:00` |
| `PGSSL` | The production database SSL setting |

The worker calculates the next 02:00 UTC execution on startup and schedules the following run for the next UTC day. A restart does not cause an immediate cleanup run, which prevents deployment restarts from creating an unexpected database load spike.

## Rollout verification

After deployment, verify the worker log contains a line similar to:

```text
[sync-retention-worker] started; runAt=02:00 UTC days=90
```

It should then report the next scheduled execution. After the first run, verify the completion log includes `retentionDays: 90`, `changesDeleted`, and `mutationsDeleted`. Confirm that the worker remains healthy and that no `processing` mutation is deleted.

Keep the API and retention worker as separate services. The worker is deterministic database maintenance and should not be replaced by an AI-triggered scheduled task. If the worker is unavailable, leave the data intact and restore the worker before manually running cleanup.
