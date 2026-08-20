const router = require('express').Router();
const ctrl = require('../controllers/sync.controller');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { SyncMutationSchema, SyncPullSchema } = require('../validators/sync.validators');

router.use(requireAuth);
router.post('/mutations', validate({ body: SyncMutationSchema }), ctrl.pushMutation);
router.get('/changes', validate({ query: SyncPullSchema }), ctrl.pullChanges);

module.exports = router;
