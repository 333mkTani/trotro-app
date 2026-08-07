const { v4: uuidv4 } = require('uuid');
const { withTransaction } = require('../config/db');
const walletModel = require('../models/wallet.model');
const profileModel = require('../models/profile.model');
const bookingModel = require('../models/booking.model');
const paystackService = require('./paystack.service');
const { ApiError } = require('../utils/ApiError');

const getBalance = async (userId) => {
  const w = await walletModel.ensureWallet(userId);
  return w;
};

const listTransactions = (userId, opts) => walletModel.listTransactions(userId, opts);

// Starts a Paystack transaction and records a matching 'pending' ledger
// entry. The wallet balance is NOT touched here — only verifyTopUp(), after
// Paystack confirms payment server-side, is allowed to credit it.
const initializeTopUp = async (userId, { amount, paymentMethod, callbackUrl }) => {
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw ApiError.badRequest('Amount must be positive');
  }

  const profile = await profileModel.findById(userId);
  if (!profile) throw ApiError.notFound('Profile not found');
  const email = profile.email || `${(profile.phone || userId).replace(/[^0-9a-zA-Z]/g, '')}@wallet.trotro.app`;

  const reference = `TOPUP_${Date.now()}_${uuidv4().slice(0, 8)}`;

  await walletModel.ensureWallet(userId);
  await walletModel.insertTransaction({
    userId,
    type: 'top_up',
    amount: parsedAmount,
    description: 'Wallet top-up via Paystack',
    status: 'pending',
    paymentMethod: paymentMethod || null,
    reference,
  });

  const paystackData = await paystackService.initializeTransaction({
    email,
    amountPesewas: Math.round(parsedAmount * 100),
    reference,
    metadata: { userId, purpose: 'wallet_topup' },
    callbackUrl,
  });

  return {
    reference,
    authorizationUrl: paystackData.authorization_url,
    accessCode: paystackData.access_code,
  };
};

// Called after the client's Paystack popup/webview reports a result (or as
// a fallback poll). Re-verifies the transaction directly with Paystack and
// only credits the wallet using the AMOUNT PAYSTACK CONFIRMS — never the
// client-supplied one — so a forged/replayed client call can't mint
// balance. The Paystack call happens before the DB transaction so the row
// lock below isn't held across a network round trip; the lock plus the
// pending->completed status check makes double-crediting impossible even
// if verify is called twice concurrently for the same reference.
const verifyTopUp = async (userId, reference) => {
  if (!reference) throw ApiError.badRequest('Reference is required');

  const result = await paystackService.verifyTransaction(reference);

  return withTransaction(async (client) => {
    const pending = await walletModel.findTransactionByReferenceForUpdate(reference, userId, client);
    if (!pending) throw ApiError.notFound('Transaction not found');

    if (pending.status === 'completed') {
      const wallet = await walletModel.getBalance(userId, client);
      return { wallet, transaction: pending, success: true, alreadyProcessed: true };
    }
    if (pending.status !== 'pending') {
      throw ApiError.badRequest(`Transaction is ${pending.status}`);
    }

    const amountMatches = result.currency === 'GHS' && Math.abs(result.amount - Number(pending.amount)) < 0.01;

    if (!result.success || !amountMatches) {
      const failed = await walletModel.markTransactionStatus(pending.id, 'failed', client);
      return { wallet: null, transaction: failed, success: false, message: 'Payment was not completed successfully.' };
    }

    const wallet = await walletModel.adjustBalance(userId, result.amount, client);
    const completed = await walletModel.markTransactionStatus(pending.id, 'completed', client);

    return { wallet, transaction: completed, success: true };
  });
};

const charge = async (userId, { bookingId }) => {
  if (!bookingId) throw ApiError.badRequest('Booking is required');
  return withTransaction(async (client) => {
    const booking = await bookingModel.findForPaymentForUpdate(bookingId, userId, client);
    if (!booking) throw ApiError.notFound('Booking not found');
    if (booking.status !== 'confirmed') throw ApiError.badRequest('Only confirmed rides can be paid');
    if (!booking.arrived_at) throw ApiError.badRequest('Payment is available after arrival is detected');
    if (booking.code_status !== 'used') throw ApiError.badRequest('Boarding code must be redeemed before payment');
    if (!booking.driver_id) throw ApiError.badRequest('Booking has no assigned driver');

    const amount = Number(booking.authoritative_fare);
    if (!Number.isFinite(amount) || amount <= 0) throw ApiError.badRequest('Route fare is not configured');

    const existing = await walletModel.findBookingTransactionForUpdate(
      bookingId, userId, 'ride_payment', client,
    );
    if (existing) {
      const wallet = await walletModel.getBalance(userId, client);
      return { wallet, transaction: existing, alreadyProcessed: true };
    }

    const current = await walletModel.ensureWallet(userId, client);
    if (Number(current.balance) < amount) throw ApiError.badRequest('Insufficient balance');
    const wallet = await walletModel.adjustBalance(userId, -amount, client);
    const tx = await walletModel.insertTransaction(
      {
        userId,
        bookingId,
        type: 'ride_payment',
        amount: -amount,
        description: `${booking.pickup_stop_name} to ${booking.destination_stop_name}`,
        reference: `RIDE_${bookingId}_DEBIT`,
      },
      client,
    );

    await walletModel.ensureWallet(booking.driver_id, client);
    await walletModel.adjustBalance(booking.driver_id, amount, client);
    await walletModel.insertTransaction({
      userId: booking.driver_id,
      bookingId,
      type: 'driver_payment',
      amount,
      description: `Fare received for ${booking.pickup_stop_name} to ${booking.destination_stop_name}`,
      reference: `RIDE_${bookingId}_CREDIT`,
    }, client);
    return { wallet, transaction: tx };
  });
};

// Ghana mobile money bank_codes aren't hardcoded since Paystack can change
// them — resolved by matching provider id against the live bank list.
const MOMO_NAME_HINTS = {
  mtn: ['mtn'],
  vodafone: ['vodafone', 'telecel'],
  airteltigo: ['airteltigo', 'airtel', 'tigo'],
};

const resolveMomoBankCode = async (providerId) => {
  const hints = MOMO_NAME_HINTS[providerId];
  if (!hints) throw ApiError.badRequest('Unsupported mobile money provider');
  const banks = await paystackService.getBanks('mobile_money');
  const match = banks.find((b) => hints.some((h) => b.name.toLowerCase().includes(h)));
  if (!match) throw ApiError.internal('Could not resolve mobile money provider with Paystack');
  return match.code;
};

// Bank-transfer picker on the client needs a bank list, but excluding
// mobile-money channels (those are resolved separately via provider id).
const listPayoutBanks = async () => {
  const momoHints = Object.values(MOMO_NAME_HINTS).flat();
  const all = await paystackService.getBanks();
  return all.filter((b) => !momoHints.some((h) => b.name.toLowerCase().includes(h)));
};

// Driver payout via Paystack Transfers. The wallet is debited and a
// 'pending' ledger entry committed FIRST, before any Paystack call — so the
// debit is durable no matter what happens next. If Paystack's recipient/
// transfer calls fail outright, the debit is reversed. If Paystack accepts
// the transfer but hasn't confirmed it yet (status 'pending' or 'otp'), the
// transaction is left 'pending' and finalized later by the transfer.success/
// transfer.failed webhook (see handleTransferWebhook) — never guessed at
// here, since a transfer can still fail after being accepted.
const requestWithdrawal = async (userId, { amount, method, accountNumber, accountName, providerId, bankCode }) => {
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw ApiError.badRequest('Amount must be positive');
  }
  if (!accountNumber || !accountName) {
    throw ApiError.badRequest('Account details are required');
  }
  if (!['MOBILE_MONEY', 'BANK_TRANSFER'].includes(method)) {
    throw ApiError.badRequest('Invalid withdrawal method');
  }
  if (method === 'MOBILE_MONEY' && !providerId) {
    throw ApiError.badRequest('Mobile money provider is required');
  }
  if (method === 'BANK_TRANSFER' && !bankCode) {
    throw ApiError.badRequest('Bank is required');
  }

  const reference = `WD_${Date.now()}_${uuidv4().slice(0, 8)}`;

  const { wallet, transaction } = await withTransaction(async (client) => {
    const current = await walletModel.ensureWallet(userId, client);
    if (Number(current.balance) < parsedAmount) throw ApiError.badRequest('Insufficient balance');

    const debited = await walletModel.adjustBalance(userId, -parsedAmount, client);
    const tx = await walletModel.insertTransaction(
      {
        userId,
        type: 'withdrawal',
        amount: -parsedAmount,
        description: `Withdrawal to ${accountName} (${method === 'MOBILE_MONEY' ? providerId : 'bank transfer'}) — ${accountNumber}`,
        status: 'pending',
        reference,
      },
      client,
    );
    return { wallet: debited, transaction: tx };
  });

  try {
    const paystackBankCode = method === 'MOBILE_MONEY' ? await resolveMomoBankCode(providerId) : bankCode;
    const recipientCode = await paystackService.createTransferRecipient({
      type: method === 'MOBILE_MONEY' ? 'mobile_money' : 'ghipss',
      name: accountName,
      accountNumber,
      bankCode: paystackBankCode,
    });
    const transferResult = await paystackService.initiateTransfer({
      amountPesewas: Math.round(parsedAmount * 100),
      recipientCode,
      reason: 'Driver wallet withdrawal',
      reference,
    });

    if (transferResult.status === 'success') {
      const completed = await walletModel.markTransactionStatus(transaction.id, 'completed');
      return { wallet, transaction: completed, success: true };
    }

    return { wallet, transaction, success: true, pending: true };
  } catch (err) {
    const refunded = await withTransaction(async (client) => {
      const refundedWallet = await walletModel.adjustBalance(userId, parsedAmount, client);
      const failed = await walletModel.markTransactionStatus(transaction.id, 'failed', client);
      return { wallet: refundedWallet, transaction: failed };
    });
    return {
      wallet: refunded.wallet,
      transaction: refunded.transaction,
      success: false,
      message: err.message || 'Withdrawal could not be processed. Your balance has been refunded.',
    };
  }
};

// Paystack's transfer.success/transfer.failed/transfer.reversed webhook
// events are the only authoritative source for a transfer's final state —
// initiateTransfer()'s immediate response is often just 'pending'/'otp'.
// Idempotent: the row lock + pending-only check means replayed/duplicate
// webhook deliveries for the same reference are a no-op after the first.
const handleTransferWebhook = async (event) => {
  const type = event && event.event;
  const data = (event && event.data) || {};
  if (!['transfer.success', 'transfer.failed', 'transfer.reversed'].includes(type)) return;

  const reference = data.reference;
  if (!reference) return;

  await withTransaction(async (client) => {
    const tx = await walletModel.findTransactionByReferenceOnly(reference, client);
    if (!tx || tx.type !== 'withdrawal' || tx.status !== 'pending') return;

    if (type === 'transfer.success') {
      await walletModel.markTransactionStatus(tx.id, 'completed', client);
    } else {
      await walletModel.adjustBalance(tx.user_id, Math.abs(Number(tx.amount)), client);
      await walletModel.markTransactionStatus(tx.id, 'failed', client);
    }
  });
};

module.exports = {
  getBalance,
  listTransactions,
  initializeTopUp,
  verifyTopUp,
  charge,
  requestWithdrawal,
  listPayoutBanks,
  handleTransferWebhook,
};
