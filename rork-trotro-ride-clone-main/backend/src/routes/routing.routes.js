const router = require('express').Router();
const controller = require('../controllers/routing.controller');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { DirectionsQuery } = require('../validators/routing.validator');

router.get('/directions', requireAuth, validate({ query: DirectionsQuery }), controller.directions);

module.exports = router;
