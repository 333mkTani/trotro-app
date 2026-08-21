const { asyncHandler } = require('../utils/asyncHandler');
const profileService = require('../services/profile.service');

const me = asyncHandler(async (req, res) => {
  const profile = await profileService.getMe(req.user.id);
  res.json(profile);
});

const updateMe = asyncHandler(async (req, res) => {
  const patch = { ...req.body };
  if (patch.busAlertsEnabled !== undefined && typeof patch.busAlertsEnabled !== 'boolean') {
    return res.status(400).json({ error: 'busAlertsEnabled must be a boolean' });
  }
  const updated = await profileService.updateMe(req.user.id, patch);
  res.json(updated);
});

const savePushToken = asyncHandler(async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  await profileService.savePushToken(req.user.id, token);
  res.json({ ok: true });
});

const deleteMe = asyncHandler(async (req, res) => {
  res.json(await profileService.deleteMe(req.user.id));
});

module.exports = { me, updateMe, savePushToken, deleteMe };
