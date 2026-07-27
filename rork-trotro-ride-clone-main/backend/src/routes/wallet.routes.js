const router = require('express').Router();
const ctrl = require('../controllers/wallet.controller');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

router.get('/', ctrl.getBalance);
router.get('/transactions', ctrl.listTransactions);
router.post('/topup/initialize', ctrl.initializeTopUp);
router.post('/topup/verify', ctrl.verifyTopUp);
router.post('/charge', ctrl.charge);
router.get('/banks', ctrl.listBanks);
router.post('/withdraw', ctrl.requestWithdrawal);

module.exports = router;
