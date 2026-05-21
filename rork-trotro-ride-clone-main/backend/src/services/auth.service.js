const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const { env } = require('../config/env');
const { withTransaction } = require('../config/db');
const profileModel = require('../models/profile.model');
const authModel = require('../models/auth.model');
const walletModel = require('../models/wallet.model');
const driverModel = require('../models/driver.model');
const { ApiError } = require('../utils/ApiError');

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

const register = async ({ phone, fullName, email, password, role = 'passenger', busRegistration, routeId, totalSeats = 14 }) => {
  const existing = await profileModel.findByPhone(phone);
  if (existing) throw ApiError.conflict('Phone already registered');

  const id = uuid();
  const hash = await bcrypt.hash(password, 10);

  const user = await withTransaction(async (client) => {
    // All inserts use the same transaction client — uncommitted rows from one
    // connection are invisible to others, so FK checks would fail if we mixed
    // the transaction client with the global query pool.
    await client.query(
      `INSERT INTO public.users (id, phone, email, password_hash) VALUES ($1, $2, $3, $4)`,
      [id, phone, email || null, hash],
    );
    const { rows } = await client.query(
      `INSERT INTO public.profiles (id, phone, full_name, email, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, phone, full_name, email, avatar_url, role, fcm_token, theme_mode, created_at, updated_at`,
      [id, phone, fullName, email || null, role],
    );
    await client.query(
      `INSERT INTO public.auth_credentials (user_id, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET password_hash = excluded.password_hash`,
      [id, hash],
    );
    await walletModel.ensureWallet(id, client);
    if (role === 'driver') {
      await client.query(
        `INSERT INTO public.drivers (id, full_name, phone) VALUES ($1, $2, $3)`,
        [id, fullName, phone],
      );
      if (busRegistration) {
        await client.query(
          `INSERT INTO public.buses (registration, driver_id, route_id, total_seats, seats_available)
           VALUES ($1, $2, $3, $4, $5)`,
          [busRegistration.toUpperCase(), id, routeId || null, totalSeats, totalSeats],
        );
      }
    }
    return rows[0];
  });

  return { user, token: signToken(user) };
};

const login = async ({ phone, password }) => {
  const profile = await profileModel.findByPhone(phone);
  if (!profile) throw ApiError.unauthorized('Invalid credentials');
  const creds = await authModel.findByUserId(profile.id);
  if (!creds) throw ApiError.unauthorized('Invalid credentials');
  const ok = await bcrypt.compare(password, creds.password_hash);
  if (!ok) throw ApiError.unauthorized('Invalid credentials');
  return { user: profile, token: signToken(profile) };
};

const changePassword = async (userId, { currentPassword, newPassword }) => {
  const creds = await authModel.findByUserId(userId);
  if (!creds) throw ApiError.notFound('Credentials not found');
  const ok = await bcrypt.compare(currentPassword, creds.password_hash);
  if (!ok) throw ApiError.unauthorized('Current password is incorrect');
  const hash = await bcrypt.hash(newPassword, 10);
  await authModel.upsertPassword(userId, hash);
  return { ok: true };
};

module.exports = { register, login, changePassword, signToken };
