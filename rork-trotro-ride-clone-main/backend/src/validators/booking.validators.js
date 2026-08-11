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

const CreateProvisionalBookingSchema = CreateBookingSchema.extend({
  routeId: z.string().uuid(),
  busId: z.string().uuid(),
  driverId: z.string().uuid(),
}).omit({ rideFare: true, ridePaymentMethod: true, rideSchedule: true });

const InitializeDepositSchema = z.object({
  idempotencyKey: z.string().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/),
  callbackUrl: z.string().url().optional(),
});

const VerifyDepositSchema = z.object({
  reference: z.string().min(8).max(100),
});

const InitializeBalanceSchema = InitializeDepositSchema;
const VerifyBalanceSchema = VerifyDepositSchema;

const RedeemCodeSchema = z.object({
  code: z.string().min(4).max(16),
});

const RateDriverSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

module.exports = {
  CreateBookingSchema, CreateProvisionalBookingSchema, RedeemCodeSchema, RateDriverSchema,
  InitializeDepositSchema, VerifyDepositSchema,
  InitializeBalanceSchema, VerifyBalanceSchema,
};
