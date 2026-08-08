const counters = new Map();

const log = (level, event, fields = {}) => {
  const record = { timestamp: new Date().toISOString(), level, event, ...fields };
  (level === 'error' ? console.error : console.log)(JSON.stringify(record));
  return record;
};

const increment = (name, value = 1, labels = {}) => {
  const suffix = Object.keys(labels).sort().map((key) => `${key}=${labels[key]}`).join(',');
  const key = suffix ? `${name}{${suffix}}` : name;
  counters.set(key, (counters.get(key) || 0) + value);
};

const snapshot = () => Object.fromEntries(counters);
const reset = () => counters.clear();

module.exports = { log, increment, snapshot, reset };
