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

const savePushToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  await profileService.savePushToken(req.user.id, token);
  res.json({ ok: true });
});

module.exports = { me, updateMe, savePushToken };
