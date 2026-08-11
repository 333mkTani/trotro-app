const router = require('express').Router();
const controller = require('../controllers/paymentOperations.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { UuidParam } = require('../validators/common.validators');

router.use(requireAuth, requireRole('admin'));
router.get('/bookings/:id/trace', validate({ params: UuidParam }), controller.trace);
router.post('/bookings/:id/reconcile', validate({ params: UuidParam }), controller.reconcile);

module.exports = router;
