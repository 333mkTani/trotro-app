const { asyncHandler } = require('../utils/asyncHandler');
const syncService = require('../services/sync.service');

const pushMutation = asyncHandler(async (req, res) => {
  const receipt = await syncService.processMutation(req.user, req.body);
  const statusCode = receipt.status === 'accepted' ? 200
    : receipt.status === 'duplicate' ? 200
      : receipt.status === 'retryable' ? 503
        : receipt.status === 'conflict' ? 409 : 400;
  res.status(statusCode).json(receipt);
});

const pullChanges = asyncHandler(async (req, res) => {
  res.json(await syncService.pullChanges(req.user.id, req.query));
});

module.exports = { pushMutation, pullChanges };
