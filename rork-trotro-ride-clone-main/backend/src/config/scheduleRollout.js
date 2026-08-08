const crypto = require('crypto');
const { env } = require('./env');

const bucketFor = (key) => crypto.createHash('sha256').update(String(key)).digest().readUInt32BE(0) % 100;

const isScheduledReservationsEnabled = (passengerId) => (
  env.SCHEDULED_RESERVATIONS_ENABLED
  && bucketFor(passengerId) < env.SCHEDULED_RESERVATIONS_ROLLOUT_PERCENT
);

module.exports = { bucketFor, isScheduledReservationsEnabled };
