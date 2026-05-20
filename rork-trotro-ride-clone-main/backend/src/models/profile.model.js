const { query } = require('../config/db');

const COLUMNS = `id, phone, full_name, email, avatar_url, role, fcm_token, theme_mode, created_at, updated_at`;

const findById = async (id) => {
  const { rows } = await query(`select ${COLUMNS} from public.profiles where id = $1`, [id]);
  return rows[0] || null;
};

const findByPhone = async (phone) => {
  const { rows } = await query(`select ${COLUMNS} from public.profiles where phone = $1`, [phone]);
  return rows[0] || null;
};

const insert = async ({ id, phone, fullName, email, role = 'passenger' }) => {
  const { rows } = await query(
    `insert into public.profiles (id, phone, full_name, email, role)
     values ($1, $2, $3, $4, $5)
     returning ${COLUMNS}`,
    [id, phone, fullName, email || null, role],
  );
  return rows[0];
};

const update = async (id, patch) => {
  const fields = [];
  const values = [];
  let i = 1;
  const map = {
    fullName: 'full_name',
    email: 'email',
    avatarUrl: 'avatar_url',
    fcmToken: 'fcm_token',
    themeMode: 'theme_mode',
    phone: 'phone',
  };
  for (const [key, col] of Object.entries(map)) {
    if (patch[key] !== undefined) {
      fields.push(`${col} = $${i++}`);
      values.push(patch[key]);
    }
  }
  if (!fields.length) return findById(id);
  values.push(id);
  const { rows } = await query(
    `update public.profiles set ${fields.join(', ')} where id = $${i} returning ${COLUMNS}`,
    values,
  );
  return rows[0] || null;
};

module.exports = { findById, findByPhone, insert, update };
