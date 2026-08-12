import { isPublicAuthRoute } from '../authRoute';

describe('public authentication routes', () => {
  it.each(['login', 'register', 'otp-verification', 'forgot-password'])(
    'allows unauthenticated access to %s',
    (segment) => expect(isPublicAuthRoute(segment)).toBe(true),
  );

  it.each([undefined, '(tabs)', 'tracking', 'future-seats'])(
    'keeps protected route %s behind authentication',
    (segment) => expect(isPublicAuthRoute(segment)).toBe(false),
  );
});
