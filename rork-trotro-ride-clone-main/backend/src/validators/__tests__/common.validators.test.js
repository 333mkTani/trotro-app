const { UuidParam, Pagination, NearbyQuery } = require('../common.validators');

describe('UuidParam', () => {
  it('accepts a valid uuid', () => {
    expect(UuidParam.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000' }).success).toBe(true);
  });

  it('rejects a non-uuid string', () => {
    expect(UuidParam.safeParse({ id: 'not-a-uuid' }).success).toBe(false);
  });
});

describe('Pagination', () => {
  it('coerces query-string numbers and allows omission', () => {
    const result = Pagination.parse({ limit: '25', offset: '10' });
    expect(result).toEqual({ limit: 25, offset: 10 });
    expect(Pagination.parse({})).toEqual({});
  });

  it('rejects a limit above 200', () => {
    expect(Pagination.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('rejects a negative offset', () => {
    expect(Pagination.safeParse({ offset: '-1' }).success).toBe(false);
  });
});

describe('NearbyQuery', () => {
  it('requires lat/lng and fills in sane defaults', () => {
    const result = NearbyQuery.parse({ lat: '5.6037', lng: '-0.1870' });
    expect(result).toEqual({ lat: 5.6037, lng: -0.187, radius_m: 1500, limit: 25 });
  });

  it('rejects out-of-range coordinates', () => {
    expect(NearbyQuery.safeParse({ lat: '200', lng: '0' }).success).toBe(false);
    expect(NearbyQuery.safeParse({ lat: '0', lng: '-200' }).success).toBe(false);
  });

  it('clamps radius_m and limit to their documented bounds', () => {
    expect(NearbyQuery.safeParse({ lat: '0', lng: '0', radius_m: '10' }).success).toBe(false); // below 50
    expect(NearbyQuery.safeParse({ lat: '0', lng: '0', radius_m: '999999' }).success).toBe(false); // above 50000
    expect(NearbyQuery.safeParse({ lat: '0', lng: '0', limit: '0' }).success).toBe(false); // below 1
    expect(NearbyQuery.safeParse({ lat: '0', lng: '0', limit: '101' }).success).toBe(false); // above 100
  });

  it('accepts an optional routeId uuid', () => {
    const result = NearbyQuery.safeParse({
      lat: '0',
      lng: '0',
      routeId: '123e4567-e89b-12d3-a456-426614174000',
    });
    expect(result.success).toBe(true);
  });
});
