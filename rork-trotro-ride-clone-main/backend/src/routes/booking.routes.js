const router = require('express').Router();
const ctrl = require('../controllers/booking.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UuidParam } = require('../validators/common.validators');
const {
  CreateBookingSchema,
  RedeemCodeSchema,
  RateDriverSchema,
} = require('../validators/booking.validators');

router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/', validate({ body: CreateBookingSchema }), ctrl.create);
router.post('/redeem', validate({ body: RedeemCodeSchema }), requireRole('driver', 'admin'), ctrl.redeem);

router.get('/:id', validate({ params: UuidParam }), ctrl.getById);
router.get('/:id/code', validate({ params: UuidParam }), ctrl.code);
router.post('/:id/confirm', validate({ params: UuidParam }), requireRole('driver', 'admin'), ctrl.confirm);
router.post('/:id/cancel', validate({ params: UuidParam }), ctrl.cancel);
router.post('/:id/complete', validate({ params: UuidParam }), ctrl.complete);
router.post('/:id/rate', validate({ params: UuidParam, body: RateDriverSchema }), ctrl.rate);

module.exports = router;
