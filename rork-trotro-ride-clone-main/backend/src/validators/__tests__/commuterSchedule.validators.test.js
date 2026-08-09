const {
  CreateCommuterScheduleSchema,
  UpdateCommuterScheduleSchema,
} = require('../commuterSchedule.validators');

const valid = {
  routeId: '11111111-1111-4111-8111-111111111111',
  departureStopId: '22222222-2222-4222-8222-222222222222',
  destinationStopId: '33333333-3333-4333-8333-333333333333',
  departureSlotId: '44444444-4444-4444-8444-444444444444',
  travelDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
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

  it('requires a published departure slot instead of a passenger-entered time', () => {
    const { departureSlotId: _ignored, ...withoutSlot } = valid;
    expect(() => CreateCommuterScheduleSchema.parse(withoutSlot)).toThrow();
  });

  it('does not allow clients to set deleted directly', () => {
    expect(() => UpdateCommuterScheduleSchema.parse({ status: 'deleted' })).toThrow();
  });
});
