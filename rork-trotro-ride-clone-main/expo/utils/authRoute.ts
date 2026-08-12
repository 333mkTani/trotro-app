const PUBLIC_AUTH_ROUTES = new Set([
  'login',
  'register',
  'otp-verification',
  'forgot-password',
]);

export const isPublicAuthRoute = (segment: string | undefined) =>
  segment !== undefined && PUBLIC_AUTH_ROUTES.has(segment);
