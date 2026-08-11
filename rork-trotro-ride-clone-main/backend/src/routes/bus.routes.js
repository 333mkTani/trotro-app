const router = require('express').Router();
const ctrl = require('../controllers/bus.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UuidParam, NearbyQuery, ActiveBusesQuery } = require('../validators/common.validators');

router.get('/', ctrl.list);
router.get('/active', validate({ query: ActiveBusesQuery }), ctrl.listActive);
router.get('/nearby', validate({ query: NearbyQuery }), ctrl.nearby);
router.get('/driver/:driverId/location', requireAuth, ctrl.getDriverLocation);
router.get('/:id', validate({ params: UuidParam }), ctrl.getById);
router.post('/', requireAuth, requireRole('admin'), ctrl.create);
router.patch('/:id/location', requireAuth, requireRole('driver', 'admin'), ctrl.updateLocation);

module.exports = router;
