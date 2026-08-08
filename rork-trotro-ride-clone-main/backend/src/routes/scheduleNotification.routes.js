const router = require('express').Router();
const controller = require('../controllers/scheduleNotification.controller');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { UuidParam } = require('../validators/common.validators');

router.use(requireAuth);
router.get('/', controller.list);
router.post('/:id/read', validate({ params: UuidParam }), controller.markRead);

module.exports = router;
