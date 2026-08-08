const crypto = require('crypto');
const { env } = require('./env');

const bucketFor = (key) => crypto.createHash('sha256').update(String(key)).digest().readUInt32BE(0) % 100;
const isBusAlertsEnabled = (passengerId) => (
  env.BUS_ALERTS_ENABLED && bucketFor(passengerId) < env.BUS_ALERTS_ROLLOUT_PERCENT
);

module.exports = { bucketFor, isBusAlertsEnabled };
