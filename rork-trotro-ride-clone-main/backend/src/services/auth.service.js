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
const { getAdmin } = require('../config/firebase');

const signToken = (user) =>
  jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

// Shared by register() (direct signup, phone unverified) and
// registerWithVerifiedPhone() (signup after Firebase Phone Auth succeeds —
// sets is_verified true).
const createAccount = async ({ phone, fullName, email, passwordHash, role = 'passenger', busRegistration, routeId, totalSeats = 14, verified = false }) => {
  const id = uuid();

  const user = await withTransaction(async (client) => {
    // All inserts use the same transaction client — uncommitted rows from one
    // connection are invisible to others, so FK checks would fail if we mixed
    // the transaction client with the global query pool.
    await client.query(
      `INSERT INTO public.users (id, phone, email, password_hash, is_verified) VALUES ($1, $2, $3, $4, $5)`,
      [id, phone, email || null, passwordHash, verified],
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
      [id, passwordHash],
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

const register = async ({ phone, fullName, email, password, role = 'passenger', busRegistration, routeId, totalSeats = 14 }) => {
  const existing = await profileModel.findByPhone(phone);
  if (existing) throw ApiError.conflict('Phone already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  return createAccount({ phone, fullName, email, passwordHash, role, busRegistration, routeId, totalSeats });
};

// Registration after Firebase Phone Auth verified the number client-side.
// idToken proves the caller controls the phone; we never see or store an
// OTP code ourselves.
const registerWithVerifiedPhone = async ({ idToken, fullName, email, password, role = 'passenger', busRegistration, routeId, totalSeats = 14 }) => {
  const admin = getAdmin();
  if (!admin) throw ApiError.internal('Phone verification is not configured');

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (_err) {
    throw ApiError.unauthorized('Phone verification expired or invalid — verify again');
  }

  const phone = decoded.phone_number;
  if (!phone) throw ApiError.badRequest('Token has no verified phone number');

  const existing = await profileModel.findByPhone(phone);
  if (existing) throw ApiError.conflict('Phone already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  return createAccount({ phone, fullName, email, passwordHash, role, busRegistration, routeId, totalSeats, verified: true });
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

module.exports = { register, login, changePassword, signToken, createAccount, registerWithVerifiedPhone };
