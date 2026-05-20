const router = require('express').Router();
const ctrl = require('../controllers/wallet.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.getBalance);
router.get('/transactions', ctrl.listTransactions);
router.post('/topup', ctrl.topUp);
router.post('/charge', ctrl.charge);

module.exports = router;
