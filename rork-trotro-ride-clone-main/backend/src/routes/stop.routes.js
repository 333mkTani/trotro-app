const router = require('express').Router();
const ctrl = require('../controllers/stop.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UuidParam, NearbyQuery } = require('../validators/common.validators');
const { CreateStopSchema } = require('../validators/stop.validators');

router.get('/', ctrl.list);
router.get('/nearby', validate({ query: NearbyQuery }), ctrl.nearby);
router.get('/:id', validate({ params: UuidParam }), ctrl.getById);
router.post(
  '/', requireAuth, requireRole('admin'),
  validate({ body: CreateStopSchema }), ctrl.create,
);

module.exports = router;
