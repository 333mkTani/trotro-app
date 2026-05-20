const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { RegisterSchema, LoginSchema, ChangePasswordSchema } = require('../validators/auth.validators');

router.post('/register', validate({ body: RegisterSchema }), ctrl.register);
router.post('/login', validate({ body: LoginSchema }), ctrl.login);
router.get('/me', requireAuth, ctrl.me);
router.post('/change-password', requireAuth, validate({ body: ChangePasswordSchema }), ctrl.changePassword);

module.exports = router;
