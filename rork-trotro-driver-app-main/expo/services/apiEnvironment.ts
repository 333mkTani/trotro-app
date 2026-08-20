export type MobileApiEnvironment = 'development' | 'staging' | 'production';

const DEFAULT_API_URLS: Record<MobileApiEnvironment, string> = {
  development: 'http://localhost:4000',
  staging: 'https://trotro-staging-api.onrender.com',
  production: 'https://trotro-api.onrender.com',
};

const normalizeUrl = (value: string) => value.trim().replace(/\/$/, '');

export const getMobileApiEnvironment = (
  value = process.env.EXPO_PUBLIC_API_ENV,
): MobileApiEnvironment => {
  const normalized = String(value || 'development').trim().toLowerCase();
  if (normalized === 'development' || normalized === 'staging' || normalized === 'production') {
    return normalized;
  }
  throw new Error(`Unsupported EXPO_PUBLIC_API_ENV: ${normalized}`);
};

export const resolveApiBaseUrl = (
  environment = getMobileApiEnvironment(),
  override = process.env.EXPO_PUBLIC_API_URL,
) => {
  const candidate = normalizeUrl(override || DEFAULT_API_URLS[environment]);
  if (!/^https?:\/\//i.test(candidate)) {
    throw new Error(`EXPO_PUBLIC_API_URL must be an absolute http(s) URL: ${candidate}`);
  }
  if (environment === 'production' && /trotro-staging-api\.onrender\.com/i.test(candidate)) {
    throw new Error('Production mobile builds cannot target the staging API');
  }
  if (environment === 'staging' && /trotro-api\.onrender\.com/i.test(candidate)) {
    throw new Error('Staging mobile builds cannot target the production API');
  }
  return candidate;
};

export const MOBILE_API_ENV = getMobileApiEnvironment();
export const API_BASE_URL = resolveApiBaseUrl(MOBILE_API_ENV);
