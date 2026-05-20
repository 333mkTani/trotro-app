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

const register = async ({ phone, fullName, email, password, role = 'passenger' }) => {
  const existing = await profileModel.findByPhone(phone);
  if (existing) throw ApiError.conflict('Phone already registered');

  const id = uuid();
  const hash = await bcrypt.hash(password, 10);

  const user = await withTransaction(async (client) => {
    const profile = await profileModel.insert({ id, phone, fullName, email, role });
    await authModel.upsertPassword(id, hash);
    await walletModel.ensureWallet(id, client);
    if (role === 'driver') {
      await driverModel.insert({ id, fullName, phone });
    }
    return profile;
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
