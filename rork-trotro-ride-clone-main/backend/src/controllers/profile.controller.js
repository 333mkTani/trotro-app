const { asyncHandler } = require('../utils/asyncHandler');
const profileService = require('../services/profile.service');

const me = asyncHandler(async (req, res) => {
  const profile = await profileService.getMe(req.user.id);
  res.json(profile);
});

const updateMe = asyncHandler(async (req, res) => {
  const updated = await profileService.updateMe(req.user.id, req.body);
  res.json(updated);
});

module.exports = { me, updateMe };
