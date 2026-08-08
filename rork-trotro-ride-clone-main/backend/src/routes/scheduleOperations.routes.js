const router = require('express').Router();
const controller = require('../controllers/scheduleOperations.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { UuidParam } = require('../validators/common.validators');

router.use(requireAuth, requireRole('admin'));
router.get('/metrics', controller.metrics);
router.get('/occurrences/:id', validate({ params: UuidParam }), controller.traceOccurrence);

module.exports = router;
