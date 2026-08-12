const { z } = require('zod');

const coordinateKeys = ['originLat', 'originLng', 'destinationLat', 'destinationLng'];
const hasCompleteCoordinateSet = (value) => {
  const supplied = coordinateKeys.filter((key) => value[key] !== undefined);
  return supplied.length === 0 || supplied.length === coordinateKeys.length;
};

const CreateRouteSchema = z.object({
  name: z.string().min(1).max(120),
  origin: z.string().min(1).max(120),
  destination: z.string().min(1).max(120),
  originLat: z.coerce.number().min(-90).max(90).optional(),
  originLng: z.coerce.number().min(-180).max(180).optional(),
  destinationLat: z.coerce.number().min(-90).max(90).optional(),
  destinationLng: z.coerce.number().min(-180).max(180).optional(),
  distanceKm: z.coerce.number().min(0).max(9999).optional(),
  durationMin: z.coerce.number().int().min(0).max(1440).optional(),
  fare: z.coerce.number().min(0).max(999999),
  city: z.string().min(1).max(60).optional(),
}).refine(hasCompleteCoordinateSet, {
  message: 'Provide all four origin and destination coordinates together',
});

/** Partial edit — at least one field must be present. */
const UpdateRouteSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  origin: z.string().min(1).max(120).optional(),
  destination: z.string().min(1).max(120).optional(),
  originLat: z.coerce.number().min(-90).max(90).nullable().optional(),
  originLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  destinationLat: z.coerce.number().min(-90).max(90).nullable().optional(),
  destinationLng: z.coerce.number().min(-180).max(180).nullable().optional(),
  distanceKm: z.coerce.number().min(0).max(9999).nullable().optional(),
  durationMin: z.coerce.number().int().min(0).max(1440).nullable().optional(),
  fare: z.coerce.number().min(0).max(999999).optional(),
  city: z.string().min(1).max(60).optional(),
  status: z.enum(['active', 'paused']).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field must be provided',
}).refine(hasCompleteCoordinateSet, {
  message: 'Provide all four origin and destination coordinates together',
});

const RouteListQuery = z.object({
  city: z.string().min(1).max(60).optional(),
});

/** Admin listing may include paused/deleted routes. */
const AdminRouteListQuery = z.object({
  city: z.string().min(1).max(60).optional(),
  status: z.enum(['active', 'paused', 'deleted', 'all']).optional(),
});

/**
 * Full ordered replacement of a route's stops. An empty array clears them.
 * A stop may only appear once — route_stops is unique on (route_id, stop_id).
 */
const RouteStopsSchema = z.object({
  stopIds: z.array(z.string().uuid()).max(100),
}).refine(({ stopIds }) => new Set(stopIds).size === stopIds.length, {
  message: 'A stop can only appear once on a route',
  path: ['stopIds'],
});

module.exports = {
  CreateRouteSchema, UpdateRouteSchema, RouteListQuery, AdminRouteListQuery,
  RouteStopsSchema,
};
