const { z } = require('zod');

const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm in 24-hour time');
const TravelDay = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const CreateCommuterScheduleSchema = z.object({
  routeId: z.string().uuid(),
  departureStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  departureSlotId: z.string().uuid(),
  travelDays: z.array(TravelDay).min(1).max(7).transform((days) => [...new Set(days)]),
  timezone: z.literal('Africa/Accra').default('Africa/Accra'),
  primaryDeadlineLocal: LocalTime.default('20:00'),
  backupMatchingEnabled: z.boolean().default(false),
}).superRefine((data, ctx) => {
  if (data.departureStopId === data.destinationStopId) {
    ctx.addIssue({ code: 'custom', path: ['destinationStopId'], message: 'Destination must differ from departure station' });
  }
});

const UpdateCommuterScheduleSchema = z.object({
  routeId: z.string().uuid().optional(),
  departureStopId: z.string().uuid().optional(),
  destinationStopId: z.string().uuid().optional(),
  departureSlotId: z.string().uuid().optional(),
  travelDays: z.array(TravelDay).min(1).max(7).transform((days) => [...new Set(days)]).optional(),
  timezone: z.literal('Africa/Accra').optional(),
  primaryDeadlineLocal: LocalTime.optional(),
  backupMatchingEnabled: z.boolean().optional(),
  status: z.enum(['active', 'paused']).optional(),
}).strict().superRefine((data, ctx) => {
  const changesSlotSelection = data.routeId || data.departureStopId || data.destinationStopId || data.travelDays;
  if (changesSlotSelection && !data.departureSlotId) {
    ctx.addIssue({ code: 'custom', path: ['departureSlotId'], message: 'Choose a published departure slot for route, station, or day changes' });
  }
});

module.exports = { CreateCommuterScheduleSchema, UpdateCommuterScheduleSchema };
