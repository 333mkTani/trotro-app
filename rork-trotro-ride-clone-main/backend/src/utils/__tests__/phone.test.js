const { toE164Gh, ghPhoneVariants } = require('../phone');

describe('Ghana phone normalization', () => {
  test.each([
    ['0245678901', '+233245678901'],
    ['245678901', '+233245678901'],
    ['233245678901', '+233245678901'],
    ['+233 24 567 8901', '+233245678901'],
  ])('normalizes %s to E.164', (input, expected) => {
    expect(toE164Gh(input)).toBe(expected);
  });

  test('returns all legacy lookup variants', () => {
    expect(ghPhoneVariants('+233245678901')).toEqual([
      '+233245678901',
      '0245678901',
      '245678901',
    ]);
  });
});
