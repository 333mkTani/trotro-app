const { query, withTransaction } = require('../config/db');

const COLUMNS = `id, phone, full_name, email, avatar_url, role, fcm_token, theme_mode,
  bus_alerts_enabled, created_at, updated_at`;

const findById = async (id) => {
  const { rows } = await query(`select ${COLUMNS} from public.profiles where id = $1`, [id]);
  return rows[0] || null;
};

const findByPhone = async (phone) => {
  const { rows } = await query(`select ${COLUMNS} from public.profiles where phone = $1`, [phone]);
  return rows[0] || null;
};

const findByPhoneVariants = async (phones, preferredPhone) => {
  const { rows } = await query(
    `select ${COLUMNS}
       from public.profiles
      where phone = any($1::text[])
      order by case when phone = $2 then 0 else 1 end, created_at desc`,
    [phones, preferredPhone],
  );
  return rows;
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
    busAlertsEnabled: 'bus_alerts_enabled',
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

const isActive = async (id) => {
  const { rows } = await query(
    `select 1 from public.profiles where id = $1 and deleted_at is null`,
    [id],
  );
  return rows.length > 0;
};

const deactivate = async (id) => withTransaction(async (client) => {
  const { rows } = await client.query(
    `update public.profiles
        set phone = 'deleted:' || id::text,
            full_name = 'Deleted User',
            email = null,
            avatar_url = null,
            fcm_token = null,
            bus_alerts_enabled = false,
            deleted_at = now(),
            updated_at = now()
      where id = $1 and deleted_at is null
      returning id, deleted_at`,
    [id],
  );
  if (!rows[0]) return null;

  await client.query(
    `update public.users
        set phone = 'deleted:' || id::text,
            email = null,
            password_hash = encode(gen_random_bytes(32), 'hex'),
            updated_at = now()
      where id = $1`,
    [id],
  );
  await client.query(`delete from public.auth_credentials where user_id = $1`, [id]);
  return rows[0];
});

module.exports = { findById, findByPhone, findByPhoneVariants, update, isActive, deactivate };
