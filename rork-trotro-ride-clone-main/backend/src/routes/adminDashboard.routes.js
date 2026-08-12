const router = require('express').Router();
const controller = require('../controllers/adminDashboard.controller');
const { requireAuth, requireRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { SeriesQuery, BookingListQuery } = require('../validators/adminDashboard.validators');
const { AdminRouteListQuery } = require('../validators/route.validators');

router.use(requireAuth, requireRole('admin'));

router.get('/overview', controller.overview);
router.get('/series', validate({ query: SeriesQuery }), controller.series);
router.get('/bookings', validate({ query: BookingListQuery }), controller.bookings);
router.get('/fleet', controller.fleet);
router.get('/routes', validate({ query: AdminRouteListQuery }), controller.routes);
router.get('/route-performance', validate({ query: SeriesQuery }), controller.routePerformance);

module.exports = router;
