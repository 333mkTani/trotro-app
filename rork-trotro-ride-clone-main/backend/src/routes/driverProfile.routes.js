const { Router } = require('express');
const { requireAuth, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/driverProfile.controller');

const router = Router();

router.use(requireAuth, requireRole('driver', 'admin'));

router.get('/me',           ctrl.getProfile);
router.get('/me/dashboard', ctrl.getDashboard);
router.patch('/me/availability', ctrl.setAvailability);
router.patch('/me/driving-status', ctrl.setDrivingStatus);
router.patch('/me/seats',        ctrl.updateSeats);
router.patch('/me/location',     ctrl.updateLocation);
router.patch('/me/route',        ctrl.updateRoute);

module.exports = router;
