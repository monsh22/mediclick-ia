// Adaptador de salida: implementa UserRepository con PostgreSQL
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { DEMO_USERS } from './seed.js';

const UUID = /^[0-9a-f-]{36}$/i;

const COLS = {
  name: 'name', email: 'email', role: 'role', phone: 'phone', birthDate: 'birth_date', bloodType: 'blood_type',
  allergies: 'allergies', chronicConditions: 'chronic_conditions', currentMedications: 'current_medications',
  emergencyContact: 'emergency_contact', telegramChatId: 'telegram_chat_id',
};

const map = (r) => r && ({
  id: r.id,
  name: r.name,
  email: r.email,
  role: r.role,
  passwordHash: r.password_hash,
  phone: r.phone,
  birthDate: r.birth_date,
  bloodType: r.blood_type,
  allergies: r.allergies,
  chronicConditions: r.chronic_conditions,
  currentMedications: r.current_medications,
  emergencyContact: r.emergency_contact,
  telegramChatId: r.telegram_chat_id,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export async function createUserRepository(databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  pg.types.setTypeParser(1082, (v) => v); // fechas DATE como texto AAAA-MM-DD

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'paciente',
      phone TEXT,
      birth_date DATE,
      blood_type TEXT,
      allergies TEXT,
      chronic_conditions TEXT,
      telegram_chat_id TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    -- Columnas nuevas (se agregan sin perder datos si la tabla ya existía)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS current_medications TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
  `);

  // Datos de prueba (solo se insertan si no existen)
  const passwords = [...new Set(DEMO_USERS.map((u) => u.password))];
  const hashes = Object.fromEntries(await Promise.all(passwords.map(async (p) => [p, await bcrypt.hash(p, 10)])));
  for (const u of DEMO_USERS) {
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (email) DO NOTHING`,
      [u.id, u.name, u.email, hashes[u.password], u.role],
    );
  }

  return {
    async findByEmail(email) {
      const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
      return map(rows[0]);
    },
    /** Si hay varias cuentas con ese chat, prefiere la de la app (correo real) */
    async findByTelegramChatId(chatId) {
      const { rows } = await pool.query(
        `SELECT * FROM users WHERE telegram_chat_id=$1
         ORDER BY (email LIKE '%@telegram.mediclick.com') ASC, created_at ASC LIMIT 1`, [chatId]);
      return map(rows[0]);
    },
    async findById(id) {
      if (!UUID.test(id || '')) return null;
      const { rows } = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
      return map(rows[0]);
    },
    async create({ name, email, passwordHash, role }) {
      const { rows } = await pool.query(
        'INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING *',
        [name, email, passwordHash, role],
      );
      return map(rows[0]);
    },
    async update(id, fields) {
      if (!UUID.test(id || '')) return null;
      const keys = Object.keys(fields).filter((k) => COLS[k]);
      if (!keys.length) return this.findById(id);
      const sets = keys.map((k, i) => `${COLS[k]}=$${i + 2}`).join(', ');
      const { rows } = await pool.query(
        `UPDATE users SET ${sets}, updated_at=now() WHERE id=$1 RETURNING *`, [id, ...keys.map((k) => fields[k])]);
      return map(rows[0]);
    },

    // ---- Administración ----
    async list({ q, role } = {}) {
      const where = [];
      const params = [];
      if (role) { params.push(role); where.push(`role=$${params.length}`); }
      if (q) { params.push(`%${q.toLowerCase()}%`); where.push(`(lower(name) LIKE $${params.length} OR lower(email) LIKE $${params.length})`); }
      const { rows } = await pool.query(
        `SELECT * FROM users ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY created_at DESC LIMIT 500`, params);
      return rows.map(map);
    },
    async countByRole() {
      const { rows } = await pool.query(`SELECT role, count(*)::int AS n FROM users GROUP BY role`);
      const out = { total: 0, paciente: 0, medico: 0, admin: 0, telegram: 0 };
      for (const r of rows) { out[r.role] = r.n; out.total += r.n; }
      const tg = await pool.query(`SELECT count(*)::int AS n FROM users WHERE telegram_chat_id IS NOT NULL`);
      out.telegram = tg.rows[0].n;
      return out;
    },
    async setPassword(id, passwordHash) {
      if (!UUID.test(id || '')) return null;
      const { rows } = await pool.query('UPDATE users SET password_hash=$2, updated_at=now() WHERE id=$1 RETURNING *', [id, passwordHash]);
      return map(rows[0]);
    },
    async delete(id) {
      await pool.query('DELETE FROM users WHERE id=$1', [id]);
    },
  };
}
