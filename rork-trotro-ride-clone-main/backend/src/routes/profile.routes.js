const router = require('express').Router();
const ctrl = require('../controllers/profile.controller');
const { requireAuth } = require('../middleware/auth');

router.get('/me', requireAuth, ctrl.me);
router.patch('/me', requireAuth, ctrl.updateMe);

module.exports = router;
