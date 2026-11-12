// ===== DOMINIO: reglas de agenda =====
import { DomainError } from './errors.js';

export const STATUS = { SCHEDULED: 'programada', CANCELLED: 'cancelada', DONE: 'completada' };

const pad = (n) => String(n).padStart(2, '0');

/** Día de la semana (0=domingo) de una fecha AAAA-MM-DD en la zona horaria local */
export function weekdayOf(date, offset) {
  return new Date(`${date}T12:00:00${offset}`).getUTCDay();
}

/**
 * Genera los horarios disponibles de un médico para un día.
 * @param doctor  { startHour, endHour, slotMinutes, workDays[] }
 * @param date    'AAAA-MM-DD'
 * @param booked  Set con los ISO de citas ya ocupadas
 */
export function generateSlots(doctor, date, booked, offset, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new DomainError('Fecha inválida (usa AAAA-MM-DD)', 400);
  if (!doctor.workDays.includes(weekdayOf(date, offset))) return [];

  const slots = [];
  for (let m = doctor.startHour * 60; m + doctor.slotMinutes <= doctor.endHour * 60; m += doctor.slotMinutes) {
    const start = new Date(`${date}T${pad(Math.floor(m / 60))}:${pad(m % 60)}:00${offset}`);
    const iso = start.toISOString();
    slots.push({
      startsAt: iso,
      label: `${pad(Math.floor(m / 60))}:${pad(m % 60)}`,
      available: start > now && !booked.has(iso),
    });
  }
  return slots;
}

/** Verifica que la hora pedida sea un horario válido del médico */
export function assertValidSlot(doctor, startsAt, offset, now = new Date()) {
  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) throw new DomainError('Hora de la cita inválida', 400);
  if (start <= now) throw new DomainError('No puedes agendar en una fecha u hora pasada', 400);

  // Fecha local AAAA-MM-DD de esa hora
  const local = new Date(start.getTime() + parseOffset(offset) * 60000);
  const date = local.toISOString().slice(0, 10);
  const valid = generateSlots(doctor, date, new Set(), offset, now).some((s) => s.startsAt === start.toISOString());
  if (!valid) throw new DomainError('Ese horario no pertenece a la agenda del médico', 400);
  return { startsAt: start, endsAt: new Date(start.getTime() + doctor.slotMinutes * 60000) };
}

export function assertCanModify(appt, user) {
  if (!appt) throw new DomainError('Cita no encontrada', 404);
  const isOwner = appt.patientId === user.id;
  const isDoctor = user.role === 'medico' && appt.doctorUserId === user.id;
  const isAdmin = user.role === 'admin';
  if (!isOwner && !isDoctor && !isAdmin) throw new DomainError('No puedes modificar esta cita', 403);
  if (appt.status !== STATUS.SCHEDULED) throw new DomainError(`La cita ya está ${appt.status}`, 409);
}

export function parseOffset(offset) {
  const sign = offset.startsWith('-') ? -1 : 1;
  const [h, m] = offset.replace(/[+-]/, '').split(':').map(Number);
  return sign * (h * 60 + m);
}
