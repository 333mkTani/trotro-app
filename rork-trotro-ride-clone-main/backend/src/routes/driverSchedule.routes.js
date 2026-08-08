const router = require('express').Router();
const ctrl = require('../controllers/driverSchedule.controller');
const lifecycle = require('../controllers/scheduleLifecycle.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { UuidParam } = require('../validators/common.validators');
const { DriverResponseSchema } = require('../validators/driverSchedule.validators');
const { RedeemCodeSchema } = require('../validators/booking.validators');

router.use(requireAuth, requireRole('driver', 'admin'));
router.get('/requests', ctrl.list);
router.post('/:id/accept', validate({ params: UuidParam }), ctrl.accept);
router.post('/:id/decline', validate({ params: UuidParam, body: DriverResponseSchema }), ctrl.decline);
router.post('/:id/withdraw', validate({ params: UuidParam, body: DriverResponseSchema }), ctrl.withdraw);
router.post('/boarding/redeem', validate({ body: RedeemCodeSchema }), lifecycle.redeem);
router.post('/:id/depart', validate({ params: UuidParam }), lifecycle.depart);

module.exports = router;
