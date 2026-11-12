// ===== CASOS DE USO DE ADMINISTRACIÓN =====
import { STATUS } from '../domain/schedule.js';
import { DomainError } from '../domain/errors.js';

/** Valida y normaliza los datos de un médico */
function validateDoctor(input, { partial = false } = {}) {
  const out = {};
  const str = (k, label, min = 2) => {
    if (input[k] === undefined) { if (!partial) throw new DomainError(`Falta ${label}`, 400); return; }
    const v = String(input[k]).trim();
    if (v.length < min) throw new DomainError(`${label} no válido`, 400);
    out[k] = v;
  };
  str('name', 'el nombre', 3);
  str('specialty', 'la especialidad', 3);
  if (input.office !== undefined) out.office = String(input.office).trim() || null;
  for (const [k, def, min, max] of [['startHour', 9, 0, 23], ['endHour', 15, 1, 24], ['slotMinutes', 30, 10, 120]]) {
    if (input[k] === undefined || input[k] === '') { if (!partial) out[k] = def; continue; }
    const n = Number(input[k]);
    if (!Number.isInteger(n) || n < min || n > max) throw new DomainError(`Valor inválido para ${k}`, 400);
    out[k] = n;
  }
  if (out.startHour !== undefined && out.endHour !== undefined && out.endHour <= out.startHour) {
    throw new DomainError('La hora de salida debe ser mayor a la de entrada', 400);
  }
  if (input.workDays !== undefined) {
    const days = (Array.isArray(input.workDays) ? input.workDays : String(input.workDays).split(','))
      .map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    if (!days.length) throw new DomainError('Elige al menos un día de trabajo', 400);
    out.workDays = [...new Set(days)].sort();
  } else if (!partial) out.workDays = [1, 2, 3, 4, 5, 6];
  if (input.userId !== undefined) out.userId = /^[0-9a-f-]{36}$/i.test(input.userId || '') ? input.userId : null;
  if (input.active !== undefined) out.active = input.active === true || input.active === 'true';
  return out;
}

export function makeAdminUseCases({ uc, doctorRepo, apptRepo, events }) {
  const admin = (adminId) => ({ id: adminId, role: 'admin' });

  return {
    async stats() {
      return { citas: await apptRepo.stats(), medicos: await doctorRepo.stats() };
    },

    // ---- Médicos ----
    listDoctors: () => doctorRepo.listAll(),

    async createDoctor(adminId, input) {
      const doctor = await doctorRepo.create(validateDoctor(input));
      await events.publish('medico.creado', { doctorId: doctor.id, name: doctor.name, specialty: doctor.specialty, by: adminId });
      return doctor;
    },

    async updateDoctor(adminId, id, input) {
      if (!(await doctorRepo.findById(id))) throw new DomainError('Médico no encontrado', 404);
      const doctor = await doctorRepo.update(id, validateDoctor(input, { partial: true }));
      await events.publish('medico.actualizado', { doctorId: id, by: adminId });
      return doctor;
    },

    /** Baja lógica: el médico deja de aparecer y se cancelan sus citas futuras */
    async deactivateDoctor(adminId, id) {
      const doctor = await doctorRepo.findById(id);
      if (!doctor) throw new DomainError('Médico no encontrado', 404);
      await doctorRepo.update(id, { active: false });
      const future = await apptRepo.futureByDoctor(id);
      for (const a of future) await uc.cancel(admin(adminId), a.id);
      await events.publish('medico.baja', { doctorId: id, name: doctor.name, citasCanceladas: future.length, by: adminId });
      return { ok: true, citasCanceladas: future.length };
    },

    // ---- Citas ----
    listAppointments: (filters) => apptRepo.listAll(filters),
    cancelAppointment: (adminId, id) => uc.cancel(admin(adminId), id),

    async deleteAppointment(adminId, id) {
      const appt = await apptRepo.findById(id);
      if (!appt) throw new DomainError('Cita no encontrada', 404);
      if (appt.status === STATUS.SCHEDULED) await uc.cancel(admin(adminId), id); // avisa y quita recordatorios
      await apptRepo.remove(id);
      await events.publish('cita.eliminada', { appointmentId: id, by: adminId });
      return { ok: true };
    },

    // ---- Reacción a eventos de otros servicios (RabbitMQ) ----
    async onUserDeleted({ userId, role }) {
      const future = await apptRepo.futureByPatient(userId);
      for (const a of future) await uc.cancel({ id: userId, role: 'paciente' }, a.id);
      if (role === 'medico') {
        const doctor = await doctorRepo.findByUserId(userId);
        if (doctor) await this.deactivateDoctor('sistema', doctor.id);
      }
      console.log(`[admin] usuario ${userId} eliminado -> ${future.length} citas canceladas`);
    },
  };
}
