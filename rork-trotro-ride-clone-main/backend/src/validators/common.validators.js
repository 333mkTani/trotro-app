const { z } = require('zod');

const UuidParam = z.object({ id: z.string().uuid() });

const Pagination = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/** Spatial query: ?lat=&lng=&radius_m=&limit= */
const NearbyQuery = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_m: z.coerce.number().min(50).max(50000).optional().default(1500),
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  routeId: z.string().uuid().optional(),
});

/** ?stop_id=&route_name= — filters /buses/active to buses approaching a stop */
const ActiveBusesQuery = z.object({
  stop_id: z.string().uuid().optional(),
  route_name: z.string().min(1).max(120).optional(),
});

module.exports = { UuidParam, Pagination, NearbyQuery, ActiveBusesQuery };
