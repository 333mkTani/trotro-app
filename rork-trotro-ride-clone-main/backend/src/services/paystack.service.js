const crypto = require('crypto');
const { env } = require('../config/env');
const { ApiError } = require('../utils/ApiError');

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

const authHeaders = () => {
  if (!env.PAYSTACK_SECRET_KEY) throw ApiError.internal('Payment gateway is not configured');
  return {
    Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  };
};

// amountPesewas: integer, smallest currency unit (GHS * 100) — Paystack requires this.
const initializeTransaction = async ({ email, amountPesewas, reference, metadata, callbackUrl }) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      email,
      amount: amountPesewas,
      currency: 'GHS',
      reference,
      metadata,
      callback_url: callbackUrl || undefined,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw ApiError.badRequest(data?.message || 'Failed to initialize payment');
  }
  return data.data; // { authorization_url, access_code, reference }
};

const verifyTransaction = async (reference) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: authHeaders(),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw ApiError.badRequest(data?.message || 'Failed to verify payment');
  }

  const tx = data.data;
  return {
    success: tx.status === 'success',
    reference: tx.reference,
    amount: tx.amount / 100,
    currency: tx.currency,
    channel: tx.channel,
    paidAt: tx.paid_at,
    gatewayResponse: tx.gateway_response,
  };
};

const createRefund = async ({ transactionReference, amountPesewas, merchantNote }) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
    method: 'POST', headers: authHeaders(),
    body: JSON.stringify({
      transaction: transactionReference,
      amount: amountPesewas,
      currency: 'GHS',
      merchant_note: merchantNote,
    }),
  });
  const data = await response.json();
  if (!response.ok || !data.status) throw ApiError.badRequest(data?.message || 'Failed to create refund');
  return {
    id: String(data.data.id), status: data.data.status,
    amount: Number(data.data.amount) / 100,
    transactionReference,
  };
};

const getRefund = async (refundId) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}/refund/${encodeURIComponent(refundId)}`, {
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok || !data.status) throw ApiError.badRequest(data?.message || 'Failed to fetch refund');
  return {
    id: String(data.data.id), status: data.data.status,
    amount: Number(data.data.amount) / 100,
    transactionReference: data.data.transaction?.reference || data.data.transaction_reference,
  };
};

const listRefundsForTransaction = async (transactionReference) => {
  const params = new URLSearchParams({ transaction: transactionReference, perPage: '20' });
  const response = await fetch(`${PAYSTACK_BASE_URL}/refund?${params.toString()}`, {
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok || !data.status) throw ApiError.badRequest(data?.message || 'Failed to list refunds');
  return (data.data || []).map((item) => ({
    id: String(item.id), status: item.status, amount: Number(item.amount) / 100,
    transactionReference: item.transaction?.reference || transactionReference,
  }));
};

// Ghana bank/mobile-money codes aren't hardcoded here since Paystack can add
// or change them — instead we fetch the live list and match by name. Cached
// in-memory per process since the list rarely changes and Paystack rate-limits.
const bankListCache = new Map(); // type -> { fetchedAt, banks }
const BANK_CACHE_TTL_MS = 60 * 60 * 1000;

const getBanks = async (type) => {
  const cacheKey = type || 'ghipss';
  const cached = bankListCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < BANK_CACHE_TTL_MS) {
    return cached.banks;
  }

  const params = new URLSearchParams({ country: 'ghana', currency: 'GHS' });
  if (type) params.set('type', type);

  const response = await fetch(`${PAYSTACK_BASE_URL}/bank?${params.toString()}`, {
    headers: authHeaders(),
  });
  const data = await response.json();
  if (!response.ok || !data.status) {
    throw ApiError.badRequest(data?.message || 'Failed to fetch bank list');
  }

  const banks = (data.data || []).map((b) => ({ name: b.name, code: b.code }));
  bankListCache.set(cacheKey, { fetchedAt: Date.now(), banks });
  return banks;
};

const createTransferRecipient = async ({ type, name, accountNumber, bankCode }) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transferrecipient`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      type,
      name,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'GHS',
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw ApiError.badRequest(data?.message || 'Failed to resolve payout account');
  }
  return data.data.recipient_code;
};

// amountPesewas: integer, GHS * 100. source is always the Paystack balance —
// this moves real money out once the recipient is valid.
const initiateTransfer = async ({ amountPesewas, recipientCode, reason, reference }) => {
  const response = await fetch(`${PAYSTACK_BASE_URL}/transfer`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      source: 'balance',
      amount: amountPesewas,
      recipient: recipientCode,
      reason,
      reference,
    }),
  });

  const data = await response.json();
  if (!response.ok || !data.status) {
    throw ApiError.badRequest(data?.message || 'Failed to initiate payout');
  }

  // Paystack transfer status is one of: success | pending | otp | failed.
  // 'otp' means the Paystack account has OTP-on-transfer enabled, which
  // blocks server-initiated transfers from ever completing automatically —
  // that must be disabled in the Paystack dashboard (Settings > Preferences).
  return { status: data.data.status, transferCode: data.data.transfer_code };
};

const verifyWebhookSignature = (rawBody, signatureHeader) => {
  if (!env.PAYSTACK_SECRET_KEY || !signatureHeader) return false;
  const hash = crypto.createHmac('sha512', env.PAYSTACK_SECRET_KEY).update(rawBody).digest('hex');
  const expected = Buffer.from(hash, 'utf8');
  const supplied = Buffer.from(String(signatureHeader), 'utf8');
  return expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
};

module.exports = {
  initializeTransaction,
  verifyTransaction,
  createRefund,
  getRefund,
  listRefundsForTransaction,
  getBanks,
  createTransferRecipient,
  initiateTransfer,
  verifyWebhookSignature,
};
