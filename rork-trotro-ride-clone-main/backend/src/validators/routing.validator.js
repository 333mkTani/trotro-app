const { z } = require('zod');

const booleanQuery = z.preprocess((value) => {
  if (value === undefined) return true;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return value;
}, z.boolean());

const DirectionsQuery = z.object({
  originLat: z.coerce.number().finite().min(-90).max(90),
  originLng: z.coerce.number().finite().min(-180).max(180),
  destinationLat: z.coerce.number().finite().min(-90).max(90),
  destinationLng: z.coerce.number().finite().min(-180).max(180),
  profile: z.enum(['walking', 'driving', 'driving-traffic']).default('driving'),
  steps: booleanQuery.default(true),
}).strict();

module.exports = { DirectionsQuery };
