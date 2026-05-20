const { asyncHandler } = require('../utils/asyncHandler');
const walletService = require('../services/wallet.service');

const getBalance = asyncHandler(async (req, res) => {
  res.json(await walletService.getBalance(req.user.id));
});

const listTransactions = asyncHandler(async (req, res) => {
  res.json(await walletService.listTransactions(req.user.id, { limit: req.query.limit }));
});

const topUp = asyncHandler(async (req, res) => {
  res.status(201).json(await walletService.topUp(req.user.id, req.body));
});

const charge = asyncHandler(async (req, res) => {
  res.status(201).json(await walletService.charge(req.user.id, req.body));
});

module.exports = { getBalance, listTransactions, topUp, charge };
