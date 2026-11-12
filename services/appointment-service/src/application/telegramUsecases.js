// ===== CASOS DE USO PARA EL ASISTENTE DE TELEGRAM =====
// Reutilizan los casos de uso normales (book, cancel, reschedule) para que las
// reglas de negocio y los eventos de RabbitMQ sean EXACTAMENTE los mismos que en la app.
// Devuelven datos "amigables" (fechas en español, horas HH:MM) para que la IA los entienda.
import { parseOffset } from '../domain/schedule.js';
import { DomainError } from '../domain/errors.js';

const TZ = 'America/Mexico_City';
const UUID = /^[0-9a-f-]{36}$/i;
const norm = (t = '') => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const pad = (n) => String(n).padStart(2, '0');

export function makeTelegramUseCases({ uc, doctorRepo, apptRepo, offset }) {
  const offMin = parseOffset(offset);

  const todayLocal = () => new Date(Date.now() + offMin * 60000).toISOString().slice(0, 10);
  const addDays = (date, n) => new Date(new Date(`${date}T12:00:00Z`).getTime() + n * 86400000).toISOString().slice(0, 10);
  const dayLabel = (date) =>
    new Date(`${date}T12:00:00${offset}`).toLocaleDateString('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
  const whenLabel = (iso) =>
    new Date(iso).toLocaleString('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false });

  /** Acepta "cardiologia", "Cardiología", "corazon"... y devuelve la especialidad oficial */
  async function matchSpecialty(input) {
    const all = await doctorRepo.specialties();
    const q = norm(input);
    if (!q) throw new DomainError(`Indica una especialidad. Disponibles: ${all.join(', ')}`, 400);
    const found = all.find((s) => norm(s) === q) || all.find((s) => norm(s).includes(q) || q.includes(norm(s)));
    if (!found) throw new DomainError(`No tenemos "${input}". Especialidades disponibles: ${all.join(', ')}`, 404);
    return found;
  }

  /** Acepta el ID del médico o su nombre ("Ana López") */
  async function resolveDoctor(idOrName) {
    if (UUID.test(idOrName || '')) {
      const d = await doctorRepo.findById(idOrName);
      if (d) return d;
    }
    const q = norm(idOrName).replace(/^(dra?|psic)\.?\s*/, '');
    const d = (await doctorRepo.list()).find((x) => norm(x.name).includes(q));
    if (!d) throw new DomainError('No encontré a ese médico. Consulta primero la disponibilidad.', 404);
    return d;
  }

  /** "9:00", "09:00", "9" -> "09:00" ; valida AAAA-MM-DD */
  function toStartsAt(date, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new DomainError('La fecha debe tener formato AAAA-MM-DD', 400);
    const m = String(time || '').trim().match(/^(\d{1,2})(?::(\d{2}))?/);
    if (!m) throw new DomainError('La hora debe tener formato HH:MM (24 horas)', 400);
    return new Date(`${date}T${pad(m[1])}:${m[2] || '00'}:00${offset}`).toISOString();
  }

  const asUser = (patientId, name) => {
    if (!UUID.test(patientId || '')) throw new DomainError('Paciente no identificado', 400);
    return { id: patientId, role: 'paciente', name: name || 'Paciente Telegram' };
  };

  const summary = (a) => ({
    citaId: a.id,
    especialidad: a.specialty,
    medico: a.doctorName,
    consultorio: a.office,
    cuando: whenLabel(a.startsAt),
    estado: a.status,
    motivo: a.reason,
  });

  return {
    specialties: () => doctorRepo.specialties(),

    /** Directorio de médicos (opcionalmente de una especialidad) */
    async doctors(specialty) {
      const official = specialty && norm(specialty) ? await matchSpecialty(specialty) : null;
      const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
      const list = await doctorRepo.list(official || undefined);
      return {
        total: list.length,
        medicos: list.map((d) => ({
          doctorId: d.id,
          nombre: d.name,
          especialidad: d.specialty,
          consultorio: d.office,
          horario: `${pad(d.startHour)}:00 a ${pad(d.endHour)}:00`,
          dias: d.workDays.map((x) => DAYS[x]).join(', '),
        })),
      };
    },

    /**
     * Horarios libres de una especialidad.
     * Sin fecha: busca los próximos 3 días con lugar (hasta 10 días adelante).
     */
    async availability({ specialty, date }) {
      const official = await matchSpecialty(specialty);
      const doctors = await doctorRepo.list(official);
      const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : null;
      const dates = validDate ? [validDate] : Array.from({ length: 10 }, (_, i) => addDays(todayLocal(), i));

      const days = [];
      for (const d of dates) {
        const docs = [];
        for (const doc of doctors) {
          const { slots } = await uc.getSlots(doc.id, d);
          const times = slots.filter((s) => s.available).map((s) => s.label);
          if (times.length) docs.push({ doctorId: doc.id, medico: doc.name, consultorio: doc.office, horasLibres: times.slice(0, 12) });
        }
        if (docs.length) days.push({ fecha: d, dia: dayLabel(d), medicos: docs });
        if (days.length >= 3) break;
      }
      return {
        especialidad: official,
        hoy: todayLocal(),
        dias: days,
        nota: days.length ? 'Usa doctorId, fecha (AAAA-MM-DD) y hora (HH:MM) exactos para agendar.' : 'No hay horarios libres en esas fechas. Prueba otra fecha.',
      };
    },

    async book({ patientId, patientName, doctorId, date, time, reason, channel = 'telegram' }) {
      const doctor = await resolveDoctor(doctorId);
      const tag = channel === 'app' ? '(vía Medi app)' : '(vía Telegram)';
      const appt = await uc.book(asUser(patientId, patientName), {
        doctorId: doctor.id,
        startsAt: toStartsAt(date, time),
        reason: reason ? `${reason} ${tag}` : `Consulta ${tag}`,
      });
      return { ok: true, mensaje: 'Cita agendada. Recibirás recordatorios 24 h y 2 h antes.', cita: summary(appt) };
    },

    async myAppointments(patientId) {
      const user = asUser(patientId);
      const list = (await apptRepo.listByPatient(user.id))
        .filter((a) => a.status === 'programada' && new Date(a.startsAt) > new Date())
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      return { total: list.length, citas: list.map(summary) };
    },

    async cancel({ patientId, appointmentId }) {
      const appt = await uc.cancel(asUser(patientId), appointmentId);
      return { ok: true, mensaje: 'Cita cancelada.', cita: summary(appt) };
    },

    async reschedule({ patientId, appointmentId, date, time }) {
      const appt = await uc.reschedule(asUser(patientId), appointmentId, { startsAt: toStartsAt(date, time) });
      return { ok: true, mensaje: 'Cita reagendada.', cita: summary(appt) };
    },
  };
}
