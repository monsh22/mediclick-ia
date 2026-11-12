// ===== DOMINIO =====
// Reglas de negocio puras: no saben nada de Express, Postgres ni RabbitMQ.
import { DomainError } from './errors.js';

export const ROLES = ['paciente', 'medico', 'admin'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateNewUser({ name, email, password, role = 'paciente' }, { allowAnyRole = false } = {}) {
  if (!name || name.trim().length < 3) throw new DomainError('El nombre debe tener al menos 3 letras', 400);
  if (!email || !EMAIL_RE.test(email)) throw new DomainError('Correo electrónico no válido', 400);
  if (!password || password.length < 6) throw new DomainError('La contraseña debe tener al menos 6 caracteres', 400);
  if (!ROLES.includes(role)) throw new DomainError('Rol no válido', 400);
  // Por seguridad, desde el registro público solo se crean pacientes (el admin puede crear cualquier rol)
  if (!allowAnyRole && role !== 'paciente') throw new DomainError('Solo se pueden registrar pacientes desde la app', 403);
  return { name: name.trim(), email: email.trim().toLowerCase(), password, role };
}

// Campos del expediente básico que el paciente puede editar
export const PROFILE_FIELDS = [
  'name', 'phone', 'birthDate', 'bloodType', 'allergies', 'chronicConditions',
  'currentMedications', 'emergencyContact', 'telegramChatId',
];

const BLOOD = /^(A|B|AB|O)[+-]$/;

/** Acepta 15/03/1990, 15-03-1990 o 1990-03-15 */
function normalizeDate(v) {
  if (!v) return v;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  throw new DomainError('La fecha de nacimiento debe tener formato AAAA-MM-DD o DD/MM/AAAA', 400);
}

/**
 * @param skipEmpty  true = ignora campos vacíos (para Telegram: la IA manda todos los campos
 *                   aunque el paciente solo quiera cambiar uno, así no se borran los demás)
 */
export function sanitizeProfileUpdate(input = {}, { skipEmpty = false } = {}) {
  const out = {};
  for (const k of PROFILE_FIELDS) {
    if (input[k] === undefined || input[k] === null) continue;
    const v = typeof input[k] === 'string' ? input[k].trim() : input[k];
    if (v === '') {
      if (!skipEmpty) out[k] = null;
      continue;
    }
    out[k] = v;
  }
  if (out.name !== undefined && (!out.name || out.name.length < 3)) {
    throw new DomainError('El nombre debe tener al menos 3 letras', 400);
  }
  if (out.birthDate) out.birthDate = normalizeDate(out.birthDate);
  if (out.bloodType) {
    out.bloodType = String(out.bloodType).toUpperCase().replace(/\s/g, '').replace('POSITIVO', '+').replace('NEGATIVO', '-');
    if (!BLOOD.test(out.bloodType)) throw new DomainError('Tipo de sangre no válido (ej. O+, A-, AB+)', 400);
  }
  return out;
}

/** Vista pública del usuario (nunca exponemos el hash de la contraseña) */
export function toPublicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return { ...rest, isTelegramOnly: /@telegram\.mediclick\.com$/.test(u.email || '') };
}
