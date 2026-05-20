const { z } = require('zod');

const CreateBookingSchema = z.object({
  routeId: z.string().uuid().optional(),
  busId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  pickupStopId: z.string().uuid(),
  pickupStopName: z.string().min(1),
  destinationStopId: z.string().uuid(),
  destinationStopName: z.string().min(1),
  desiredArrivalTime: z.string().datetime(),
  bufferMinutes: z.union([z.literal(10), z.literal(15), z.literal(20)]),
  routeName: z.string().optional(),
  rideFare: z.number().nonnegative().optional(),
  ridePaymentMethod: z.enum(['wallet', 'cash']).optional(),
  rideSchedule: z.any().optional(),
});

const UpdateStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'expired']),
  driverId: z.string().uuid().optional(),
  busId: z.string().uuid().optional(),
});

const RedeemCodeSchema = z.object({
  code: z.string().min(4).max(16),
});

const RateDriverSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

module.exports = { CreateBookingSchema, UpdateStatusSchema, RedeemCodeSchema, RateDriverSchema };
