const { z } = require('zod');

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const SeriesQuery = z.object({
  days: z.coerce.number().int().min(1).max(180).optional().default(30),
});

const BookingListQuery = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled', 'expired']).optional(),
  paymentStatus: z.enum([
    'unpaid', 'deposit_pending', 'deposit_paid', 'balance_pending', 'fully_paid',
    'refund_pending', 'partially_refunded', 'refunded', 'failed',
  ]).optional(),
  routeId: z.string().uuid().optional(),
  driverId: z.string().uuid().optional(),
  from: IsoDate.optional(),
  to: IsoDate.optional(),
  search: z.string().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

module.exports = { SeriesQuery, BookingListQuery };
