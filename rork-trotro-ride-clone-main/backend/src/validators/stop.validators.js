const { z } = require('zod');

/**
 * `geom` is not accepted here — a trigger derives it from lat/lng, which is
 * what the nearby-stop search reads (see migration 012).
 */
const CreateStopSchema = z.object({
  name: z.string().min(1).max(120),
  type: z.enum(['stop', 'station']).optional(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

module.exports = { CreateStopSchema };
