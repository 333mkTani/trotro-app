const { RegisterSchema, RegisterVerifiedSchema } = require('../auth.validators');

describe('public registration roles', () => {
  const common = {
    phone: '+233555000111',
    fullName: 'Test User',
    password: 'supersecret',
  };

  it('does not allow an administrator role through direct registration', () => {
    expect(RegisterSchema.safeParse({ ...common, role: 'admin' }).success).toBe(false);
  });

  it('does not allow an administrator role through verified registration', () => {
    expect(RegisterVerifiedSchema.safeParse({
      ...common,
      idToken: 'verified-token-value',
      role: 'admin',
    }).success).toBe(false);
  });

  it.each(['passenger', 'driver'])('continues to allow the %s role', (role) => {
    expect(RegisterSchema.safeParse({ ...common, role }).success).toBe(true);
  });
});
