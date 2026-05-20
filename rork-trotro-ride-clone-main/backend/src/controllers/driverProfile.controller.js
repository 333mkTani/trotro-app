const { asyncHandler } = require('../utils/asyncHandler');
const svc = require('../services/driverProfile.service');

const getProfile = asyncHandler(async (req, res) => {
  const data = await svc.getProfile(req.user.id);
  res.json(data);
});

const getDashboard = asyncHandler(async (req, res) => {
  const data = await svc.getDashboard(req.user.id);
  res.json(data);
});

const setAvailability = asyncHandler(async (req, res) => {
  const { isAvailable } = req.body;
  const bus = await svc.setAvailability(req.user.id, isAvailable);
  res.json(bus);
});

const updateSeats = asyncHandler(async (req, res) => {
  const { availableSeats, totalSeats } = req.body;
  const bus = await svc.updateSeats(req.user.id, { availableSeats, totalSeats });
  res.json(bus);
});

const updateLocation = asyncHandler(async (req, res) => {
  const { lat, lng } = req.body;
  const bus = await svc.updateLocation(req.user.id, { lat, lng });
  res.json(bus);
});

module.exports = { getProfile, getDashboard, setAvailability, updateSeats, updateLocation };
