const router = require('express').Router();
const ctrl = require('../controllers/webhook.controller');

router.post('/paystack', ctrl.handlePaystackWebhook);

module.exports = router;
