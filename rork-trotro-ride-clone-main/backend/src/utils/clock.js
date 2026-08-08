const { env } = require('../config/env');

const now = () => {
  if (env.NODE_ENV === 'test' && env.SCHEDULE_TEST_NOW) {
    const frozen = new Date(env.SCHEDULE_TEST_NOW);
    if (!Number.isNaN(frozen.getTime())) return frozen;
  }
  return new Date();
};

module.exports = { now };
