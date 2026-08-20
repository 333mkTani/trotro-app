import { getMobileApiEnvironment, resolveApiBaseUrl } from '@/services/apiEnvironment';

describe('passenger API environment', () => {
  it('selects each supported environment', () => {
    expect(getMobileApiEnvironment('development')).toBe('development');
    expect(getMobileApiEnvironment('staging')).toBe('staging');
    expect(getMobileApiEnvironment('production')).toBe('production');
  });

  it('resolves explicit defaults and overrides', () => {
    expect(resolveApiBaseUrl('development')).toBe('http://localhost:4000');
    expect(resolveApiBaseUrl('staging')).toContain('trotro-staging-api');
    expect(resolveApiBaseUrl('production')).toContain('trotro-api.onrender.com');
    expect(resolveApiBaseUrl('staging', 'https://staging.example/api/')).toBe('https://staging.example/api');
  });

  it('rejects invalid or cross-environment configuration', () => {
    expect(() => getMobileApiEnvironment('qa' as never)).toThrow('Unsupported');
    expect(() => resolveApiBaseUrl('production', 'https://trotro-staging-api.onrender.com')).toThrow('staging');
    expect(() => resolveApiBaseUrl('staging', 'https://trotro-api.onrender.com')).toThrow('production');
  });
});
