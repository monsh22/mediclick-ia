// ===== CASOS DE USO =====
// Puertos que se inyectan:
//   doctorRepo  { list(specialty?), specialties(), findById(id), findByUserId(userId) }
//   apptRepo    { bookedStarts(doctorId, from, to), create(data), findById(id),
//                 listByPatient(id), listByDoctor(id), update(id, fields) }
//   events      { publish(routingKey, data) }
import { generateSlots, assertValidSlot, assertCanModify, STATUS } from '../domain/schedule.js';
import { DomainError } from '../domain/errors.js';

export function makeUseCases({ doctorRepo, apptRepo, events, offset }) {
  const eventPayload = (a, doctor) => ({
    appointmentId: a.id,
    patientId: a.patientId,
    patientName: a.patientName,
    doctorId: a.doctorId,
    doctorUserId: doctor?.userId,
    doctorName: doctor?.name,
    specialty: a.specialty,
    office: doctor?.office,
    startsAt: a.startsAt,
    reason: a.reason,
    status: a.status,
  });

  // Regla: un médico no puede tener dos citas a la misma hora
  async function assertFree(doctorId, slot) {
    const taken = await apptRepo.bookedStarts(doctorId, slot.startsAt, slot.endsAt);
    if (taken.length) throw new DomainError('Ese horario ya está ocupado, elige otro', 409);
  }

  return {
    listDoctors: (specialty) => doctorRepo.list(specialty),
    listSpecialties: () => doctorRepo.specialties(),

    async getSlots(doctorId, date) {
      const doctor = await doctorRepo.findById(doctorId);
      if (!doctor) throw new DomainError('Médico no encontrado', 404);
      const from = new Date(`${date}T00:00:00${offset}`);
      const to = new Date(from.getTime() + 24 * 3600 * 1000);
      const booked = new Set((await apptRepo.bookedStarts(doctorId, from, to)).map((d) => new Date(d).toISOString()));
      return { doctor, date, slots: generateSlots(doctor, date, booked, offset) };
    },

    async book(user, { doctorId, startsAt, reason }) {
      if (user.role !== 'paciente') throw new DomainError('Solo los pacientes pueden agendar citas', 403);
      const doctor = await doctorRepo.findById(doctorId);
      if (!doctor || doctor.active === false) throw new DomainError('Médico no encontrado o no disponible', 404);
      const slot = assertValidSlot(doctor, startsAt, offset);
      await assertFree(doctorId, slot);
      const appt = await apptRepo.create({
        patientId: user.id,
        patientName: user.name,
        doctorId,
        specialty: doctor.specialty,
        reason: reason?.trim() || 'Consulta',
        ...slot,
      });
      await events.publish('cita.creada', eventPayload(appt, doctor));
      return appt;
    },

    async myAppointments(user) {
      if (user.role === 'medico') {
        const doctor = await doctorRepo.findByUserId(user.id);
        return doctor ? apptRepo.listByDoctor(doctor.id) : [];
      }
      return apptRepo.listByPatient(user.id);
    },

    async cancel(user, id) {
      const appt = await apptRepo.findById(id);
      assertCanModify(appt, user);
      const updated = await apptRepo.update(id, { status: STATUS.CANCELLED });
      const doctor = await doctorRepo.findById(appt.doctorId);
      await events.publish('cita.cancelada', { ...eventPayload(updated, doctor), cancelledBy: user.role });
      return updated;
    },

    async reschedule(user, id, { startsAt }) {
      const appt = await apptRepo.findById(id);
      assertCanModify(appt, user);
      const doctor = await doctorRepo.findById(appt.doctorId);
      const slot = assertValidSlot(doctor, startsAt, offset);
      await assertFree(appt.doctorId, slot);
      const previous = appt.startsAt;
      const updated = await apptRepo.update(id, { startsAt: slot.startsAt, endsAt: slot.endsAt });
      await events.publish('cita.reagendada', { ...eventPayload(updated, doctor), previousStartsAt: previous });
      return updated;
    },
  };
}
