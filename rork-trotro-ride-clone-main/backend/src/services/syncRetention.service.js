const { withTransaction } = require('../config/db');
const { env } = require('../config/env');

const DEFAULT_RETENTION_DAYS = 90;

const retentionDays = () => Math.max(1, Number(env.SYNC_RETENTION_DAYS) || DEFAULT_RETENTION_DAYS);

const purgeExpiredSyncData = async ({ now = new Date(), days = retentionDays() } = {}) => {
  const safeDays = Math.max(1, Number(days) || DEFAULT_RETENTION_DAYS);
  return withTransaction(async (client) => {
    const cutoff = new Date(now.getTime() - safeDays * 24 * 60 * 60 * 1000);
    const changes = await client.query(
      `delete from public.sync_changes where created_at < $1`,
      [cutoff.toISOString()],
    );
    const mutations = await client.query(
      `delete from public.sync_mutations
        where processed_at < $1
          and status <> 'processing'`,
      [cutoff.toISOString()],
    );
    return {
      cutoff: cutoff.toISOString(),
      retentionDays: safeDays,
      changesDeleted: changes.rowCount || 0,
      mutationsDeleted: mutations.rowCount || 0,
    };
  });
};

module.exports = { purgeExpiredSyncData, retentionDays };
