const router = require('express').Router();
const ctrl = require('../controllers/departureSlot.controller');
const { validate } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { UuidParam } = require('../validators/common.validators');
const { DepartureSlotBody, SlotQuery } = require('../validators/departureSlot.validators');

router.get('/published', requireAuth, requireRole('passenger', 'admin'), validate({ query: SlotQuery }), ctrl.published);
router.get('/mine', requireAuth, requireRole('driver', 'admin'), ctrl.mine);
router.post('/', requireAuth, requireRole('driver', 'admin'), validate({ body: DepartureSlotBody }), ctrl.create);
router.delete('/:id', requireAuth, requireRole('driver', 'admin'), validate({ params: UuidParam }), ctrl.remove);

module.exports = router;

