const counters = new Map();
const gauges = new Map();
const startedAt = Date.now();

const safeLabel = (value) => String(value ?? 'unknown')
  .replace(/[^a-zA-Z0-9_.:-]/g, '_')
  .slice(0, 80);

const keyFor = (name, labels = {}) => {
  const parts = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${safeLabel(key)}=${safeLabel(value)}`);
  return parts.length ? `${safeLabel(name)}{${parts.join(',')}}` : safeLabel(name);
};

const increment = (name, value = 1, labels = {}) => {
  const key = keyFor(name, labels);
  counters.set(key, (counters.get(key) || 0) + Number(value));
};

const setGauge = (name, value, labels = {}) => {
  gauges.set(keyFor(name, labels), Number(value));
};

const recordEvent = (event, details = {}) => {
  increment('trotro_events_total', 1, { event });
  // Structured logs intentionally contain only operational dimensions. Never
  // include tokens, phone numbers, emails, account numbers, or provider bodies.
  console.log(JSON.stringify({
    type: 'trotro.event',
    event,
    time: new Date().toISOString(),
    ...Object.fromEntries(Object.entries(details).filter(([key]) =>
      !/(token|password|secret|email|phone|account|authorization|reference|body)/i.test(key))),
  }));
};

const snapshot = () => ({
  uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  counters: Object.fromEntries(counters),
  gauges: Object.fromEntries(gauges),
  capturedAt: new Date().toISOString(),
});

const reset = () => { counters.clear(); gauges.clear(); };

const writePrometheus = () => {
  const lines = [
    '# HELP trotro_process_uptime_seconds Process uptime in seconds.',
    '# TYPE trotro_process_uptime_seconds gauge',
    `trotro_process_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`,
  ];
  for (const [key, value] of counters) {
    lines.push(`# TYPE ${key.split('{')[0]} counter`, `${key.replace('{', '{').replace('}', '')} ${value}`);
  }
  for (const [key, value] of gauges) {
    lines.push(`# TYPE ${key.split('{')[0]} gauge`, `${key} ${value}`);
  }
  return `${lines.join('\n')}\n`;
};

module.exports = {
  increment, setGauge, recordEvent, snapshot, reset, writePrometheus,
};
