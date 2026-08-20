const { parseCorsOrigins, isOriginAllowed } = require('../cors');

describe('CORS origin policy', () => {
  it('parses and trims explicit comma-separated origins', () => {
    const policy = parseCorsOrigins(' https://passenger.example , https://admin.example ');
    expect(policy.wildcard).toBe(false);
    expect(policy.origins).toEqual(new Set(['https://passenger.example', 'https://admin.example']));
  });

  it('allows configured browser origins and rejects unknown origins', () => {
    const origins = 'https://passenger.example,https://driver.example,https://admin.example';
    expect(isOriginAllowed(origins, 'https://passenger.example')).toBe(true);
    expect(isOriginAllowed(origins, 'https://driver.example')).toBe(true);
    expect(isOriginAllowed(origins, 'https://admin.example')).toBe(true);
    expect(isOriginAllowed(origins, 'https://evil.example')).toBe(false);
  });

  it('allows requests without an Origin header for native/server clients', () => {
    expect(isOriginAllowed('https://admin.example', undefined)).toBe(true);
    expect(isOriginAllowed('https://admin.example', null)).toBe(true);
  });

  it('only treats the wildcard as open when explicitly configured', () => {
    expect(isOriginAllowed('*', 'https://any.example')).toBe(true);
    expect(isOriginAllowed('', 'https://any.example')).toBe(false);
  });
});
