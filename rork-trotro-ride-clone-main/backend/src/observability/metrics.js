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

const prometheusName = (key) => key.slice(0, key.indexOf('{') === -1 ? key.length : key.indexOf('{'));

const prometheusKey = (key) => {
  const brace = key.indexOf('{');
  if (brace === -1) return key;
  const name = key.slice(0, brace);
  const rawLabels = key.slice(brace + 1, -1);
  const labels = rawLabels
    .split(',')
    .filter(Boolean)
    .map((pair) => {
      const separator = pair.indexOf('=');
      if (separator === -1) return null;
      const labelName = pair.slice(0, separator);
      const labelValue = pair.slice(separator + 1)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n');
      return `${labelName}="${labelValue}"`;
    })
    .filter(Boolean);
  return `${name}{${labels.join(',')}}`;
};

const writeFamily = (lines, values, type) => {
  const families = new Set();
  for (const [key, value] of values) {
    const name = prometheusName(key);
    if (!families.has(name)) {
      lines.push(`# TYPE ${name} ${type}`);
      families.add(name);
    }
    lines.push(`${prometheusKey(key)} ${value}`);
  }
};

const writePrometheus = () => {
  const lines = [
    '# HELP trotro_process_uptime_seconds Process uptime in seconds.',
    '# TYPE trotro_process_uptime_seconds gauge',
    `trotro_process_uptime_seconds ${Math.floor((Date.now() - startedAt) / 1000)}`,
  ];
  writeFamily(lines, counters, 'counter');
  writeFamily(lines, gauges, 'gauge');
  return `${lines.join('\n')}\n`;
};

module.exports = {
  increment, setGauge, recordEvent, snapshot, reset, writePrometheus,
};
