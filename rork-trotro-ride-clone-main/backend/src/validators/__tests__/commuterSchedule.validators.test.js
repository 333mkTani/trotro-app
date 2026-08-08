const {
  CreateCommuterScheduleSchema,
  UpdateCommuterScheduleSchema,
} = require('../commuterSchedule.validators');

const valid = {
  routeId: '11111111-1111-4111-8111-111111111111',
  departureStopId: '22222222-2222-4222-8222-222222222222',
  destinationStopId: '33333333-3333-4333-8333-333333333333',
  travelDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
  boardingStartLocal: '06:00',
  boardingEndLocal: '06:30',
};

describe('commuter schedule validation', () => {
  it('applies safe Ghana defaults', () => {
    expect(CreateCommuterScheduleSchema.parse(valid)).toMatchObject({
      timezone: 'Africa/Accra',
      primaryDeadlineLocal: '20:00',
      backupMatchingEnabled: false,
    });
  });

  it('deduplicates selected weekdays', () => {
    expect(CreateCommuterScheduleSchema.parse({ ...valid, travelDays: ['mon', 'mon'] }).travelDays)
      .toEqual(['mon']);
  });

  it('rejects the same departure and destination', () => {
    expect(() => CreateCommuterScheduleSchema.parse({
      ...valid, destinationStopId: valid.departureStopId,
    })).toThrow('Destination must differ from departure station');
  });

  it('rejects an invalid boarding window', () => {
    expect(() => CreateCommuterScheduleSchema.parse({
      ...valid, boardingEndLocal: '05:59',
    })).toThrow('Boarding window must end after it starts');
  });

  it('does not allow clients to set deleted directly', () => {
    expect(() => UpdateCommuterScheduleSchema.parse({ status: 'deleted' })).toThrow();
  });
});
