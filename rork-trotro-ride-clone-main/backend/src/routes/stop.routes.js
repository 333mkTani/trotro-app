const router = require('express').Router();
const ctrl = require('../controllers/stop.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UuidParam, NearbyQuery } = require('../validators/common.validators');
const { CreateStopSchema, UpdateStopSchema } = require('../validators/stop.validators');

router.get('/', ctrl.list);
router.get('/nearby', validate({ query: NearbyQuery }), ctrl.nearby);
router.get('/:id', validate({ params: UuidParam }), ctrl.getById);
router.post(
  '/', requireAuth, requireRole('admin'),
  validate({ body: CreateStopSchema }), ctrl.create,
);
router.patch(
  '/:id', requireAuth, requireRole('admin'),
  validate({ params: UuidParam, body: UpdateStopSchema }), ctrl.update,
);
router.delete(
  '/:id', requireAuth, requireRole('admin'),
  validate({ params: UuidParam }), ctrl.archive,
);

module.exports = router;
