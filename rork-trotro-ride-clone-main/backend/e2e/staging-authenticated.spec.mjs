import { test, expect } from '@playwright/test';

const baseURL = String(process.env.E2E_STAGING_BASE_URL || '').replace(/\/$/, '');
const environment = process.env.E2E_ENV;
const confirmation = process.env.E2E_CONFIRM;
const passengerPhone = process.env.E2E_PASSENGER_PHONE;
const passengerPassword = process.env.E2E_PASSENGER_PASSWORD;
const routeId = process.env.E2E_ROUTE_ID || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

const assertSafeStaging = () => {
  if (!baseURL) throw new Error('E2E_STAGING_BASE_URL is required');
  if (environment !== 'staging') throw new Error('E2E_ENV=staging is required');
  if (confirmation !== 'I_UNDERSTAND_STAGING_E2E') {
    throw new Error('set E2E_CONFIRM=I_UNDERSTAND_STAGING_E2E');
  }
  const hostname = new URL(baseURL).hostname.toLowerCase();
  if (hostname === 'trotro-api.onrender.com') throw new Error('production API host is not allowed');
  if (!/^https:\/\//i.test(baseURL) && process.env.E2E_ALLOW_HTTP !== 'true') {
    throw new Error('HTTPS staging URL is required');
  }
  if (!passengerPhone || !passengerPassword) {
    throw new Error('seeded E2E_PASSENGER_PHONE and E2E_PASSENGER_PASSWORD are required');
  }
};

const assertJson = async (response, expectedStatus = 200) => {
  expect(response.status(), await response.text()).toBe(expectedStatus);
  return response.json();
};

test.describe('authenticated seeded staging API', () => {
  test.beforeAll(() => assertSafeStaging());
  test.describe.configure({ mode: 'serial' });

  let token;

  test('logs in with the seeded passenger and reads the authenticated profile', async ({ request }) => {
    const login = await request.post('/auth/login', {
      data: { phone: passengerPhone, password: passengerPassword },
    });
    const loginBody = await assertJson(login);
    token = loginBody.token || loginBody.data?.token;
    expect(token).toBeTruthy();

    const me = await request.get('/auth/me', {
      headers: { authorization: `Bearer ${token}` },
    });
    const meBody = await assertJson(me);
    expect(meBody.user?.role).toBe('passenger');
    expect(meBody.user?.id).toBeTruthy();
  });

  test('reads seeded wallet and booking collections with authentication', async ({ request }) => {
    const headers = { authorization: `Bearer ${token}` };
    const wallet = await request.get('/wallet', { headers });
    const walletBody = await assertJson(wallet);
    expect(walletBody).toBeTruthy();

    const bookings = await request.get('/bookings', { headers });
    const bookingsBody = await assertJson(bookings);
    expect(Array.isArray(bookingsBody) || Array.isArray(bookingsBody.bookings) || Array.isArray(bookingsBody.data)).toBeTruthy();
  });

  test('reads seeded route and ordered route stops', async ({ request }) => {
    const route = await request.get(`/routes/${routeId}`);
    const routeBody = await assertJson(route);
    expect(routeBody.id || routeBody.route?.id).toBe(routeId);

    const stops = await request.get(`/routes/${routeId}/stops`);
    const stopsBody = await assertJson(stops);
    const rows = Array.isArray(stopsBody) ? stopsBody : stopsBody.stops || stopsBody.data;
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows.map((row) => row.sequence)).toEqual([...rows].sort((a, b) => a - b).map((row) => row.sequence));
  });

  test('rejects an unauthenticated protected read', async ({ request }) => {
    const response = await request.get('/wallet');
    expect(response.status()).toBe(401);
  });
});
