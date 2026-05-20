const { withTransaction } = require('../config/db');
const walletModel = require('../models/wallet.model');
const { ApiError } = require('../utils/ApiError');

const getBalance = async (userId) => {
  const w = await walletModel.ensureWallet(userId);
  return w;
};

const listTransactions = (userId, opts) => walletModel.listTransactions(userId, opts);

const topUp = async (userId, { amount, paymentMethod, reference, description }) => {
  if (amount <= 0) throw ApiError.badRequest('Amount must be positive');
  return withTransaction(async (client) => {
    await walletModel.ensureWallet(userId, client);
    const wallet = await walletModel.adjustBalance(userId, amount, client);
    const tx = await walletModel.insertTransaction(
      {
        userId,
        type: 'top_up',
        amount,
        description: description || 'Wallet top-up',
        paymentMethod: paymentMethod || null,
        reference: reference || null,
      },
      client,
    );
    return { wallet, transaction: tx };
  });
};

const charge = async (userId, { amount, bookingId, description, type = 'ride_payment' }) => {
  if (amount <= 0) throw ApiError.badRequest('Amount must be positive');
  return withTransaction(async (client) => {
    const current = await walletModel.ensureWallet(userId, client);
    if (Number(current.balance) < amount) throw ApiError.badRequest('Insufficient balance');
    const wallet = await walletModel.adjustBalance(userId, -amount, client);
    const tx = await walletModel.insertTransaction(
      {
        userId,
        bookingId: bookingId || null,
        type,
        amount: -amount,
        description: description || 'Ride payment',
      },
      client,
    );
    return { wallet, transaction: tx };
  });
};

module.exports = { getBalance, listTransactions, topUp, charge };
