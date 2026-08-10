const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { RegisterSchema, RegisterVerifiedSchema, LoginSchema, ChangePasswordSchema, ResetPasswordSchema } = require('../validators/auth.validators');

router.post('/register', validate({ body: RegisterSchema }), ctrl.register);

// Phone verification at signup happens client-side via Firebase Phone Auth;
// this just verifies the resulting ID token and creates the account.
router.post('/register-verified', validate({ body: RegisterVerifiedSchema }), ctrl.registerVerified);

router.post('/login', validate({ body: LoginSchema }), ctrl.login);
router.get('/me', requireAuth, ctrl.me);
router.post('/change-password', requireAuth, validate({ body: ChangePasswordSchema }), ctrl.changePassword);
router.post('/reset-password', validate({ body: ResetPasswordSchema }), ctrl.resetPassword);

module.exports = router;
