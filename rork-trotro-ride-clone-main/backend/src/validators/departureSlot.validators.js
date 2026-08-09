const { z } = require('zod');

const LocalTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm in 24-hour time');
const TravelDay = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

const DepartureSlotBody = z.object({
  routeId: z.string().uuid(),
  departureStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
  travelDays: z.array(TravelDay).min(1).max(7).transform((days) => [...new Set(days)]),
  boardingStartLocal: LocalTime,
  boardingEndLocal: LocalTime,
  timezone: z.literal('Africa/Accra').default('Africa/Accra'),
}).superRefine((data, ctx) => {
  if (data.departureStopId === data.destinationStopId) ctx.addIssue({ code: 'custom', path: ['destinationStopId'], message: 'Destination must differ from departure station' });
  if (data.boardingEndLocal <= data.boardingStartLocal) ctx.addIssue({ code: 'custom', path: ['boardingEndLocal'], message: 'Boarding window must end after it starts' });
});

const SlotQuery = z.object({
  routeId: z.string().uuid(),
  departureStopId: z.string().uuid(),
  destinationStopId: z.string().uuid(),
});

module.exports = { DepartureSlotBody, SlotQuery };

