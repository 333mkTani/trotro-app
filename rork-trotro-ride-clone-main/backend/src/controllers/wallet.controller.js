const { asyncHandler } = require('../utils/asyncHandler');
const walletService = require('../services/wallet.service');

const getBalance = asyncHandler(async (req, res) => {
  res.json(await walletService.getBalance(req.user.id));
});

const listTransactions = asyncHandler(async (req, res) => {
  res.json(await walletService.listTransactions(req.user.id, { limit: req.query.limit }));
});

const initializeTopUp = asyncHandler(async (req, res) => {
  res.status(201).json(await walletService.initializeTopUp(req.user.id, req.body));
});

const verifyTopUp = asyncHandler(async (req, res) => {
  const result = await walletService.verifyTopUp(req.user.id, req.body.reference);
  res.status(result.success ? 200 : 402).json(result);
});

const charge = asyncHandler(async (req, res) => {
  res.status(201).json(await walletService.charge(req.user.id, req.body));
});

const requestWithdrawal = asyncHandler(async (req, res) => {
  const result = await walletService.requestWithdrawal(req.user.id, req.body);
  res.status(result.success ? 201 : 402).json(result);
});

const listBanks = asyncHandler(async (req, res) => {
  res.json(await walletService.listPayoutBanks());
});

module.exports = {
  getBalance,
  listTransactions,
  initializeTopUp,
  verifyTopUp,
  charge,
  requestWithdrawal,
  listBanks,
};
