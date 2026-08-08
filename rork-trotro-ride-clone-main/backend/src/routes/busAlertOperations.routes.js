const router = require('express').Router();
const controller = require('../controllers/busAlertOperations.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { UuidParam } = require('../validators/common.validators');

router.use(requireAuth, requireRole('admin'));
router.get('/metrics', controller.metrics);
router.get('/alerts/:id', validate({ params: UuidParam }), controller.traceAlert);
module.exports = router;
