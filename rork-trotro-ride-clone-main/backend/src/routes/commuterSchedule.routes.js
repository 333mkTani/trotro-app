const router = require('express').Router();
const ctrl = require('../controllers/commuterSchedule.controller');
const lifecycle = require('../controllers/scheduleLifecycle.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UuidParam } = require('../validators/common.validators');
const {
  CreateCommuterScheduleSchema,
  UpdateCommuterScheduleSchema,
} = require('../validators/commuterSchedule.validators');

router.use(requireAuth, requireRole('passenger', 'admin'));
router.get('/', ctrl.list);
router.post('/', validate({ body: CreateCommuterScheduleSchema }), ctrl.create);
router.get('/occurrences', ctrl.allOccurrences);
router.get('/occurrences/:id/code', validate({ params: UuidParam }), lifecycle.getCode);
router.post('/occurrences/:id/cancel', validate({ params: UuidParam }), lifecycle.cancel);
router.get('/:id', validate({ params: UuidParam }), ctrl.getById);
router.get('/:id/occurrences', validate({ params: UuidParam }), ctrl.occurrences);
router.patch('/:id', validate({ params: UuidParam, body: UpdateCommuterScheduleSchema }), ctrl.update);
router.delete('/:id', validate({ params: UuidParam }), ctrl.remove);

module.exports = router;
