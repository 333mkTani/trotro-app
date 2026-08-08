const { pool } = require('../config/db');
const scheduleDispatchService = require('./scheduleDispatch.service');
const scheduleLifecycleService = require('./scheduleLifecycle.service');

// Session-level advisory lock. PostgreSQL releases it automatically if the
// worker crashes, and only one API/worker instance can hold it at a time.
const SCHEDULE_CYCLE_LOCK_ID = 742031;

const runLockedCycle = async () => {
  const lockClient = await pool.connect();
  let acquired = false;
  try {
    const { rows } = await lockClient.query(
      'select pg_try_advisory_lock($1) as acquired',
      [SCHEDULE_CYCLE_LOCK_ID],
    );
    acquired = Boolean(rows[0]?.acquired);
    if (!acquired) return { skipped: true, reason: 'lock_held' };

    const dispatch = await scheduleDispatchService.runCycle();
    const lifecycle = await scheduleLifecycleService.runCycle();
    const result = { skipped: false, dispatch, lifecycle };

    if (lifecycle.opened || lifecycle.noShows) {
      console.log('[schedule-lifecycle-worker] cycle', lifecycle);
    }
    if (dispatch.created || dispatch.reminders || dispatch.expired || dispatch.notifications) {
      console.log('[schedule-worker] cycle', dispatch);
    }
    return result;
  } finally {
    if (acquired) {
      try {
        await lockClient.query('select pg_advisory_unlock($1)', [SCHEDULE_CYCLE_LOCK_ID]);
      } catch (error) {
        console.error('[schedule-worker] advisory unlock failed:', error.message);
      }
    }
    lockClient.release();
  }
};

module.exports = { runLockedCycle, SCHEDULE_CYCLE_LOCK_ID };
