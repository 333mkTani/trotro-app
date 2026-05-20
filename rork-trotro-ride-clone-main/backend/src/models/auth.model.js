const { query } = require('../config/db');

/**
 * Auth credentials live in a separate table to avoid coupling to Supabase auth.users.
 * If you prefer Supabase auth instead, replace these calls in the auth service.
 *
 * Expected (run once if you're not using Supabase auth):
 *   create table public.auth_credentials (
 *     user_id uuid primary key references public.profiles(id) on delete cascade,
 *     password_hash text not null,
 *     created_at timestamptz not null default now()
 *   );
 */

const findByUserId = async (userId) => {
  const { rows } = await query(
    `select user_id, password_hash from public.auth_credentials where user_id = $1`,
    [userId],
  );
  return rows[0] || null;
};

const upsertPassword = async (userId, passwordHash) => {
  await query(
    `insert into public.auth_credentials (user_id, password_hash)
     values ($1, $2)
     on conflict (user_id) do update set password_hash = excluded.password_hash`,
    [userId, passwordHash],
  );
};

module.exports = { findByUserId, upsertPassword };
