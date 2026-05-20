const router = require('express').Router();
const ctrl = require('../controllers/rating.controller');

router.get('/driver/:driverId', ctrl.listForDriver);

module.exports = router;
