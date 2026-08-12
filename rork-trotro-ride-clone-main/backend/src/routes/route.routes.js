const router = require('express').Router();
const ctrl = require('../controllers/route.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UuidParam } = require('../validators/common.validators');
const {
  CreateRouteSchema, UpdateRouteSchema, RouteListQuery, RouteStopsSchema,
} = require('../validators/route.validators');

router.get('/', validate({ query: RouteListQuery }), ctrl.list);
router.get('/:id', validate({ params: UuidParam }), ctrl.getById);
router.get('/:id/stops', validate({ params: UuidParam }), ctrl.listStops);
// Whole-list replacement rather than add/remove — see routeService.setStops.
router.put(
  '/:id/stops', requireAuth, requireRole('admin'),
  validate({ params: UuidParam, body: RouteStopsSchema }), ctrl.setStops,
);
router.post(
  '/', requireAuth, requireRole('admin'),
  validate({ body: CreateRouteSchema }), ctrl.create,
);
router.patch(
  '/:id', requireAuth, requireRole('admin'),
  validate({ params: UuidParam, body: UpdateRouteSchema }), ctrl.update,
);
// Soft delete: sets status = 'deleted' (buses/bookings still reference the row).
router.delete(
  '/:id', requireAuth, requireRole('admin'),
  validate({ params: UuidParam }), ctrl.remove,
);

module.exports = router;
