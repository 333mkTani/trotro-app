const { query } = require('../config/db');

const getBalance = async (userId, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `select user_id, balance, updated_at from public.wallets where user_id = $1`,
    [userId],
  );
  return rows[0] || null;
};

const ensureWallet = async (userId, client) => {
  const runner = client || { query };
  await runner.query(
    `insert into public.wallets (user_id) values ($1) on conflict (user_id) do nothing`,
    [userId],
  );
  return getBalance(userId, client);
};

const adjustBalance = async (userId, amount, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `update public.wallets
        set balance = balance + $1
      where user_id = $2
      returning user_id, balance, updated_at`,
    [amount, userId],
  );
  return rows[0] || null;
};

const insertTransaction = async (data, client) => {
  const runner = client || { query };
  const { rows } = await runner.query(
    `insert into public.wallet_transactions
       (user_id, booking_id, type, amount, description, status, payment_method, reference)
     values ($1,$2,$3,$4,$5,coalesce($6,'completed'),$7,$8)
     returning *`,
    [
      data.userId,
      data.bookingId || null,
      data.type,
      data.amount,
      data.description,
      data.status || null,
      data.paymentMethod || null,
      data.reference || null,
    ],
  );
  return rows[0];
};

const listTransactions = async (userId, { limit = 50 } = {}) => {
  const { rows } = await query(
    `select * from public.wallet_transactions
      where user_id = $1
      order by created_at desc
      limit $2`,
    [userId, limit],
  );
  return rows;
};

module.exports = { getBalance, ensureWallet, adjustBalance, insertTransaction, listTransactions };
