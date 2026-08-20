#!/usr/bin/env node
/**
 * Staging acceptance runner for issue #27.
 *
 * Safety: this script refuses production-like hosts, live Paystack keys, and
 * execution without an explicit staging confirmation. Payment mutations are
 * opt-in with ACCEPTANCE_RUN_PAYMENTS=true and require a test-mode key.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';

const baseUrl = String(process.env.ACCEPTANCE_BASE_URL || '').replace(/\/$/, '');
const apiBase = `${baseUrl}/api`;
const environment = process.env.ACCEPTANCE_ENV;
const confirmation = process.env.ACCEPTANCE_CONFIRM;
const runPayments = process.env.ACCEPTANCE_RUN_PAYMENTS === 'true';
const replayWebhook = process.env.ACCEPTANCE_REPLAY_WEBHOOK === 'true';
const reportPath = process.env.ACCEPTANCE_REPORT || 'acceptance-report.json';
const results = [];

const record = (name, status, detail = {}) => {
  const entry = { name, status, ...detail };
  results.push(entry);
  console.log(`${status === 'passed' ? 'PASS' : status === 'skipped' ? 'SKIP' : 'FAIL'} ${name}${detail.message ? ` — ${detail.message}` : ''}`);
};

const failSetup = (message) => {
  console.error(`Acceptance setup failed: ${message}`);
  process.exit(2);
};

if (!baseUrl) failSetup('ACCEPTANCE_BASE_URL is required');
if (environment !== 'staging') failSetup('ACCEPTANCE_ENV=staging is required');
if (confirmation !== 'I_UNDERSTAND_STAGING_ONLY') {
  failSetup('set ACCEPTANCE_CONFIRM=I_UNDERSTAND_STAGING_ONLY');
}
if (!/^https:\/\//i.test(baseUrl) && process.env.ACCEPTANCE_ALLOW_HTTP !== 'true') {
  failSetup('HTTPS is required; set ACCEPTANCE_ALLOW_HTTP=true only for an isolated local test server');
}
const hostname = new URL(baseUrl).hostname.toLowerCase();
if (hostname === 'trotro-api.onrender.com' || hostname === String(process.env.ACCEPTANCE_PRODUCTION_HOST || '').toLowerCase()) {
  failSetup('production Render host detected; use the staging hostname');
}
if ((runPayments || replayWebhook) && (!process.env.PAYSTACK_SECRET_KEY || !/^sk_test_/i.test(process.env.PAYSTACK_SECRET_KEY))) {
  failSetup('payment scenarios require a Paystack test-mode key beginning with sk_test_');
}

const request = async (method, path, { token, body, rawBody, headers = {}, expected = [] } = {}) => {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(body === undefined && rawBody === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
  if (expected.length && !expected.includes(response.status)) {
    const message = data?.error?.message || data?.error || `HTTP ${response.status}`;
    throw new Error(`${method} ${path}: ${message}`);
  }
  return { status: response.status, data, raw: text };
};

const value = (data, ...keys) => {
  for (const key of keys) if (data?.[key] !== undefined) return data[key];
  return undefined;
};
const listFrom = (data, ...keys) => {
  if (Array.isArray(data)) return data;
  for (const key of keys) if (Array.isArray(data?.[key])) return data[key];
  return Array.isArray(data?.data) ? data.data : [];
};
const uniquePhone = () => `024${String(Date.now()).slice(-7)}${crypto.randomInt(0, 10)}`;
const jsonReport = () => fs.writeFileSync(reportPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, environment, results }, null, 2)}\n`);

let passenger;
let booking;
let route;
let stops;
let bus;

try {
  const health = await request('GET', '/health', { expected: [200] });
  record('api.health', 'passed', { message: health.data?.service || 'healthy' });

  const ready = await request('GET', '/ready', { expected: [200, 503] });
  if (ready.status !== 200) throw new Error(`staging readiness is not healthy: ${JSON.stringify(ready.data?.checks || {})}`);
  record('api.ready', 'passed');

  passenger = {
    phone: uniquePhone(),
    password: `Accept-${crypto.randomBytes(8).toString('hex')}`,
    fullName: `Acceptance Passenger ${Date.now()}`,
    email: `acceptance-${Date.now()}@staging.invalid`,
  };
  const registration = await request('POST', '/auth/register', { body: passenger, expected: [201] });
  const passengerToken = value(registration.data, 'token') || registration.data?.data?.token;
  const passengerId = value(registration.data?.user, 'id') || registration.data?.user?.id;
  if (!passengerToken || !passengerId) throw new Error('registration response did not contain user and token');
  passenger.token = passengerToken;
  passenger.id = passengerId;
  record('registration.create-passenger', 'passed');

  const login = await request('POST', '/auth/login', { body: { phone: passenger.phone, password: passenger.password }, expected: [200] });
  if (!value(login.data, 'token')) throw new Error('login response did not contain a token');
  record('registration.login', 'passed');

  const me = await request('GET', '/auth/me', { token: passenger.token, expected: [200] });
  if (value(me.data?.user, 'id') !== passenger.id) throw new Error('auth/me returned a different user');
  record('registration.authenticated-me', 'passed');

  const wallet = await request('GET', '/wallet', { token: passenger.token, expected: [200] });
  record('wallet.initial-balance', 'passed', { message: `balance=${value(wallet.data, 'balance', 'availableBalance') ?? 'unknown'}` });

  const routesResponse = await request('GET', '/routes', { expected: [200] });
  const routes = listFrom(routesResponse.data, 'routes');
  route = routes.find((candidate) => candidate?.status !== 'deleted') || routes[0];
  if (!route?.id) throw new Error('no active route is available in staging');
  const stopsResponse = await request('GET', `/routes/${route.id}/stops`, { expected: [200] });
  stops = listFrom(stopsResponse.data, 'stops');
  if (stops.length < 2) throw new Error(`route ${route.id} has fewer than two stops`);
  const busesResponse = await request('GET', `/buses?routeId=${encodeURIComponent(route.id)}`, { expected: [200] });
  const buses = listFrom(busesResponse.data, 'buses');
  bus = buses.find((candidate) => candidate?.driver_id || candidate?.driverId) || buses[0];
  if (!bus?.id) throw new Error('no bus with a usable driver is available for booking acceptance');
  record('discovery.route-stops-bus', 'passed', { message: 'staging fixture selected' });

  const pickup = stops[0];
  const destination = stops[stops.length - 1];
  const bookingPayload = {
    routeId: route.id,
    busId: bus.id,
    driverId: bus.driver_id || bus.driverId,
    pickupStopId: pickup.id,
    pickupStopName: pickup.name,
    destinationStopId: destination.id,
    destinationStopName: destination.name,
    desiredArrivalTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    bufferMinutes: 15,
    routeName: route.name,
    rideFare: Number(route.fare || 0),
    ridePaymentMethod: 'cash',
  };
  const created = await request('POST', '/bookings', { token: passenger.token, body: bookingPayload, expected: [201] });
  booking = created.data?.booking || created.data;
  if (!booking?.id) throw new Error('booking response did not contain an id');
  record('booking.create-cash', 'passed');

  const fetched = await request('GET', `/bookings/${booking.id}`, { token: passenger.token, expected: [200] });
  if (value(fetched.data, 'id') !== booking.id && value(fetched.data?.booking, 'id') !== booking.id) throw new Error('booking lookup returned a different booking');
  record('booking.read-after-create', 'passed');

  const cancelled = await request('POST', `/bookings/${booking.id}/cancel`, { token: passenger.token, expected: [200] });
  record('booking.cancel', 'passed', { message: cancelled.data?.status || 'cancelled' });

  if (!runPayments) {
    record('payments.paystack-initialization', 'skipped', { message: 'set ACCEPTANCE_RUN_PAYMENTS=true with a sk_test_ key to opt in' });
    if (!replayWebhook) {
      record('payments.webhook-replay', 'skipped', { message: 'set ACCEPTANCE_REPLAY_WEBHOOK=true with an approved fixture to replay provider events' });
    } else {
      const fixturePath = process.env.ACCEPTANCE_WEBHOOK_FIXTURE;
      if (!fixturePath) throw new Error('ACCEPTANCE_WEBHOOK_FIXTURE is required when replaying a webhook');
      const rawWebhook = fs.readFileSync(fixturePath);
      const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawWebhook).digest('hex');
      const webhook = await request('POST', '/webhooks/paystack', {
        rawBody: rawWebhook,
        headers: { 'x-paystack-signature': signature },
        expected: [200],
      });
      if (webhook.data?.received !== true) throw new Error('webhook replay was not acknowledged');
      record('payments.webhook-replay', 'passed');
    }
  } else {
    const provisionalPayload = { ...bookingPayload };
    delete provisionalPayload.rideFare;
    delete provisionalPayload.ridePaymentMethod;
    const provisional = await request('POST', '/bookings/provisional', { token: passenger.token, body: provisionalPayload, expected: [201] });
    const provisionalBooking = provisional.data?.booking || provisional.data;
    const deposit = await request('POST', `/bookings/${provisionalBooking.id}/deposit/initialize`, {
      token: passenger.token,
      body: { idempotencyKey: `acceptance-${Date.now()}` },
      expected: [201],
    });
    if (!deposit.data?.reference && !deposit.data?.authorizationUrl) throw new Error('deposit initialization returned no Paystack checkout details');
    record('payments.deposit-initialize', 'passed');
    const topup = await request('POST', '/wallet/topup/initialize', { token: passenger.token, body: { amount: 1, paymentMethod: 'paystack' }, expected: [201] });
    record('payments.wallet-topup-initialize', 'passed', { message: topup.data?.reference ? 'checkout reference returned' : 'checkout initialized' });
    record('payments.deposit-verification', 'skipped', { message: 'requires a completed Paystack test checkout/reference' });
    record('payments.refund-withdrawal', 'skipped', { message: 'requires approved staging provider fixtures and operator confirmation' });
    if (!replayWebhook) {
      record('payments.webhook-replay', 'skipped', { message: 'set ACCEPTANCE_REPLAY_WEBHOOK=true with an approved fixture to replay provider events' });
    } else {
      const fixturePath = process.env.ACCEPTANCE_WEBHOOK_FIXTURE;
      if (!fixturePath) throw new Error('ACCEPTANCE_WEBHOOK_FIXTURE is required when replaying a webhook');
      const rawWebhook = fs.readFileSync(fixturePath);
      const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(rawWebhook).digest('hex');
      const webhook = await request('POST', '/webhooks/paystack', {
        rawBody: rawWebhook,
        headers: { 'x-paystack-signature': signature },
        expected: [200],
      });
      if (webhook.data?.received !== true) throw new Error('webhook replay was not acknowledged');
      record('payments.webhook-replay', 'passed');
    }
  }
} catch (error) {
  record('acceptance-run', 'failed', { message: error.message });
} finally {
  jsonReport();
}

const failed = results.filter((entry) => entry.status === 'failed');
if (failed.length) process.exitCode = 1;
else console.log(`Acceptance report written to ${reportPath}`);
