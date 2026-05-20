const router = require('express').Router();
const ctrl = require('../controllers/code.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UuidParam } = require('../validators/common.validators');
const { RedeemCodeSchema } = require('../validators/booking.validators');

router.use(requireAuth);

router.get('/booking/:bookingId', ctrl.getForBooking);
router.post('/redeem', validate({ body: RedeemCodeSchema }), requireRole('driver', 'admin'), ctrl.redeem);
router.post('/:id/invalidate', validate({ params: UuidParam }), requireRole('driver', 'admin'), ctrl.invalidate);

module.exports = router;
