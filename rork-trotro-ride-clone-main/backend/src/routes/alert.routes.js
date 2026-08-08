const router = require('express').Router();
const ctrl = require('../controllers/alert.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UuidParam } = require('../validators/common.validators');
const { CreateAlertSchema, UpdateAlertSchema } = require('../validators/alert.validators');

router.use(requireAuth, requireRole('passenger', 'admin'));

router.get('/', ctrl.list);
router.post('/', validate({ body: CreateAlertSchema }), ctrl.create);
router.get('/:id', validate({ params: UuidParam }), ctrl.getById);
router.patch('/:id', validate({ params: UuidParam, body: UpdateAlertSchema }), ctrl.update);
router.delete('/:id', validate({ params: UuidParam }), ctrl.remove);

module.exports = router;
