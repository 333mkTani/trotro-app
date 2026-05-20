const router = require('express').Router();
const ctrl = require('../controllers/route.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UuidParam } = require('../validators/common.validators');

router.get('/', ctrl.list);
router.get('/:id', validate({ params: UuidParam }), ctrl.getById);
router.post('/', requireAuth, requireRole('admin'), ctrl.create);

module.exports = router;
