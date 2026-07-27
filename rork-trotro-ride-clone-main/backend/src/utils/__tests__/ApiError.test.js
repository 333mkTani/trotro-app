const { ApiError } = require('../ApiError');

describe('ApiError', () => {
  it('is a real Error subclass carrying an HTTP status', () => {
    const err = new ApiError(418, 'teapot', { reason: 'short and stout' });
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(418);
    expect(err.message).toBe('teapot');
    expect(err.details).toEqual({ reason: 'short and stout' });
  });

  it.each([
    ['badRequest', 400],
    ['unauthorized', 401],
    ['forbidden', 403],
    ['notFound', 404],
    ['conflict', 409],
    ['internal', 500],
  ])('%s() produces a %i error', (factory, status) => {
    const err = ApiError[factory]('custom message');
    expect(err.status).toBe(status);
    expect(err.message).toBe('custom message');
  });

  it.each([
    ['badRequest', 'Bad Request'],
    ['unauthorized', 'Unauthorized'],
    ['forbidden', 'Forbidden'],
    ['notFound', 'Not Found'],
    ['conflict', 'Conflict'],
    ['internal', 'Internal Server Error'],
  ])('%s() falls back to a default message', (factory, defaultMessage) => {
    expect(ApiError[factory]().message).toBe(defaultMessage);
  });
});
