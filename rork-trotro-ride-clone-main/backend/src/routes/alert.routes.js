const router = require('express').Router();
const ctrl = require('../controllers/alert.controller');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { UuidParam } = require('../validators/common.validators');

router.use(requireAuth);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', validate({ params: UuidParam }), ctrl.getById);
router.patch('/:id', validate({ params: UuidParam }), ctrl.update);
router.delete('/:id', validate({ params: UuidParam }), ctrl.remove);

module.exports = router;
