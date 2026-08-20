describe('production configuration validation', () => {
  const originalEnv = { ...process.env };

  const loadEnv = (values = {}) => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://staging.example/trotro',
      CORS_ORIGIN: 'https://passenger.example,https://driver.example,https://admin.example',
      PAYSTACK_SECRET_KEY: 'sk_test_provider_value',
      MAPBOX_ACCESS_TOKEN: 'pk.server-test-value',
      FIREBASE_SERVICE_ACCOUNT: '{"project_id":"trotro-test"}',
      ...values,
    };
    return () => require('../env');
  };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  it('rejects the development JWT placeholder before startup', () => {
    const load = loadEnv({ JWT_SECRET: 'dev-secret-change-me' });
    expect(load).toThrow(/JWT_SECRET must be a generated/);
  });

  it('rejects short JWT secrets without printing the secret', () => {
    const secret = 'short-production-secret';
    const load = loadEnv({ JWT_SECRET: secret });
    let error;
    try { load(); } catch (caught) { error = caught; }
    expect(error.message).toMatch(/JWT_SECRET must be a generated/);
    expect(error.message).not.toContain(secret);
  });

  it('rejects wildcard CORS in production', () => {
    const load = loadEnv({ JWT_SECRET: 'a'.repeat(64), CORS_ORIGIN: '*' });
    expect(load).toThrow(/CORS_ORIGIN must be an explicit/);
  });

  it('rejects missing production provider configuration without printing values', () => {
    const load = loadEnv({
      JWT_SECRET: 'a'.repeat(64),
      PAYSTACK_SECRET_KEY: '',
      FIREBASE_SERVICE_ACCOUNT: '',
      MAPBOX_ACCESS_TOKEN: '',
    });
    expect(load).toThrow(/PAYSTACK_SECRET_KEY is required/);
    expect(load).toThrow(/MAPBOX_ACCESS_TOKEN is required/);
    expect(load).toThrow(/FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH is required/);
  });

  it('accepts a generated-length JWT and complete production secret contract', () => {
    const load = loadEnv({ JWT_SECRET: 'a'.repeat(64) });
    expect(load().env.JWT_SECRET).toBe('a'.repeat(64));
  });

  it('keeps development defaults available for local development only', () => {
    const load = loadEnv({ NODE_ENV: 'development', JWT_SECRET: '' });
    expect(load().env.JWT_SECRET).toBe('dev-secret-change-me');
  });
});
