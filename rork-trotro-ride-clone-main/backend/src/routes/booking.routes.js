const router = require('express').Router();
const ctrl = require('../controllers/booking.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UuidParam } = require('../validators/common.validators');
const {
  CreateBookingSchema,
  CreateProvisionalBookingSchema,
  InitializeDepositSchema,
  VerifyDepositSchema,
  InitializeBalanceSchema,
  VerifyBalanceSchema,
  RedeemCodeSchema,
  RateDriverSchema,
} = require('../validators/booking.validators');

router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/', validate({ body: CreateBookingSchema }), ctrl.create);
router.post('/provisional', requireRole('passenger'), validate({ body: CreateProvisionalBookingSchema }), ctrl.createProvisional);
router.post('/redeem', validate({ body: RedeemCodeSchema }), requireRole('driver', 'admin'), ctrl.redeem);

router.post('/:id/deposit/initialize',
  validate({ params: UuidParam, body: InitializeDepositSchema }),
  requireRole('passenger'),
  ctrl.initializeDeposit);
router.post('/:id/deposit/verify',
  validate({ params: UuidParam, body: VerifyDepositSchema }),
  requireRole('passenger'),
  ctrl.verifyDeposit);
router.post('/:id/balance/initialize',
  validate({ params: UuidParam, body: InitializeBalanceSchema }),
  requireRole('passenger'), ctrl.initializeBalance);
router.post('/:id/balance/verify',
  validate({ params: UuidParam, body: VerifyBalanceSchema }),
  requireRole('passenger'), ctrl.verifyBalance);

router.get('/:id', validate({ params: UuidParam }), ctrl.getById);
router.get('/:id/code', validate({ params: UuidParam }), ctrl.code);
router.post('/:id/confirm', validate({ params: UuidParam }), requireRole('driver', 'admin'), ctrl.confirm);
router.post('/:id/cancel', validate({ params: UuidParam }), ctrl.cancel);
router.post('/:id/complete', validate({ params: UuidParam }), ctrl.complete);
router.post('/:id/pay-cash', validate({ params: UuidParam }), ctrl.recordCashPayment);
router.post('/:id/rate', validate({ params: UuidParam, body: RateDriverSchema }), ctrl.rate);

module.exports = router;
