#!/usr/bin/env node
/**
 * Verify the deployed staging service contract.
 *
 * Required environment variables:
 *   BASE_URL                 API origin, for example https://trotro-staging-api.onrender.com
 *   PAYSTACK_SECRET_KEY      Paystack test-mode secret
 *   FIREBASE_SERVICE_ACCOUNT Single-line Firebase service-account JSON
 *   MAPBOX_ACCESS_TOKEN      Server-side Mapbox token
 *
 * The script only prints check names and status. It never prints credentials or
 * provider response bodies, which makes it safe to run in CI logs.
 */

const baseUrl = String(process.env.BASE_URL || '').replace(/\/$/, '');
const required = ['BASE_URL', 'PAYSTACK_SECRET_KEY', 'FIREBASE_SERVICE_ACCOUNT', 'MAPBOX_ACCESS_TOKEN'];
const failures = [];

const record = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
  let body = null;
  try { body = await response.json(); } catch (_) { /* status is enough for some providers */ }
  return { response, body };
};

for (const key of required) record(`configuration:${key}`, Boolean(process.env[key]));
if (!baseUrl) {
  console.error('BASE_URL is required; refusing to run external checks.');
  process.exit(1);
}

try {
  const { response, body } = await requestJson(`${baseUrl}/health`);
  record('api:liveness', response.ok && body?.ok === true, `HTTP ${response.status}`);
} catch (error) {
  record('api:liveness', false, error.message);
}

try {
  const { response, body } = await requestJson(`${baseUrl}/ready`);
  record('api:readiness', response.ok && body?.ok === true, `HTTP ${response.status}`);
} catch (error) {
  record('api:readiness', false, error.message);
}

if (process.env.PAYSTACK_SECRET_KEY) {
  try {
    const { response, body } = await requestJson('https://api.paystack.co/bank?country=ghana&perPage=1', {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    record('paystack:test-mode-credentials', response.ok && body?.status === true, `HTTP ${response.status}`);
  } catch (error) {
    record('paystack:test-mode-credentials', false, error.message);
  }
}

if (process.env.MAPBOX_ACCESS_TOKEN) {
  try {
    const url = new URL('https://api.mapbox.com/styles/v1/mapbox/streets-v12');
    url.searchParams.set('access_token', process.env.MAPBOX_ACCESS_TOKEN);
    const { response } = await requestJson(url);
    record('mapbox:server-token', response.ok, `HTTP ${response.status}`);
  } catch (error) {
    record('mapbox:server-token', false, error.message);
  }
}

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const admin = await import('firebase-admin');
    const app = admin.getApps().length
      ? admin.getApp()
      : admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    await admin.auth(app).listUsers(1);
    record('firebase:admin-credentials', true);
  } catch (error) {
    record('firebase:admin-credentials', false, error.message);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} staging check(s) failed.`);
  process.exit(1);
}
console.log('\nAll staging service checks passed.');
