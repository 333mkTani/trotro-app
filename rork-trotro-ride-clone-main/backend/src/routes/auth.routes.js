const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/auth.controller');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { RegisterSchema, RegisterVerifiedSchema, LoginSchema, ChangePasswordSchema, ResetPasswordSchema } = require('../validators/auth.validators');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'TooManyRequests', message: 'Too many authentication attempts. Please try again later.' },
});

router.post('/register', authLimiter, validate({ body: RegisterSchema }), ctrl.register);

// Phone verification at signup happens client-side via Firebase Phone Auth;
// this just verifies the resulting ID token and creates the account.
router.post('/register-verified', authLimiter, validate({ body: RegisterVerifiedSchema }), ctrl.registerVerified);

router.post('/login', authLimiter, validate({ body: LoginSchema }), ctrl.login);
router.get('/me', requireAuth, ctrl.me);
router.post('/change-password', requireAuth, validate({ body: ChangePasswordSchema }), ctrl.changePassword);
router.post('/reset-password', authLimiter, validate({ body: ResetPasswordSchema }), ctrl.resetPassword);

module.exports = router;
