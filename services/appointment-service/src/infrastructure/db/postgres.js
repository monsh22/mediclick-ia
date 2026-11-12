// Adaptadores de salida: DoctorRepository y AppointmentRepository con PostgreSQL
import pg from 'pg';
import { DomainError } from '../../domain/errors.js';

// Médicos de prueba (user_id = mismos IDs que en patient-service)
const DOCTORS = [
  ['10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000d1', 'Dra. Ana López', 'Medicina General', 'Consultorio 101', 8, 14],
  ['10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000d2', 'Dr. Carlos Méndez', 'Cardiología', 'Consultorio 201', 9, 15],
  ['10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000d3', 'Dra. Sofía Ramírez', 'Pediatría', 'Consultorio 102', 8, 14],
  ['10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000d4', 'Dr. Jorge Hernández', 'Dermatología', 'Consultorio 203', 10, 16],
  ['10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000d5', 'Dra. Laura Gómez', 'Gastroenterología', 'Consultorio 204', 9, 15],
  ['10000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-0000000000d6', 'Dra. Mariana Cruz', 'Ginecología', 'Consultorio 105', 8, 14],
  ['10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-0000000000d7', 'Dr. Luis Pérez', 'Traumatología', 'Consultorio 106', 10, 18],
  ['10000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-0000000000d8', 'Dr. Ricardo Torres', 'Neumología', 'Consultorio 207', 9, 15],
  ['10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-0000000000d9', 'Dra. Elena Vázquez', 'Neurología', 'Consultorio 208', 9, 15],
  ['10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-0000000000da', 'Dr. Andrés Morales', 'Oftalmología', 'Consultorio 109', 8, 14],
  ['10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-0000000000db', 'Dra. Patricia Ruiz', 'Otorrinolaringología', 'Consultorio 110', 10, 16],
  ['10000000-0000-4000-8000-00000000000c', '00000000-0000-4000-8000-0000000000dc', 'Psic. Daniel Castillo', 'Psicología', 'Consultorio 301', 12, 20],
];

const mapDoctor = (r) => r && ({
  id: r.id, userId: r.user_id, name: r.name, specialty: r.specialty, office: r.office,
  startHour: r.start_hour, endHour: r.end_hour, slotMinutes: r.slot_minutes, workDays: r.work_days,
  active: r.active !== false,
});

const mapAppt = (r) => r && ({
  id: r.id, patientId: r.patient_id, patientName: r.patient_name, doctorId: r.doctor_id,
  doctorName: r.doctor_name, doctorUserId: r.doctor_user_id, office: r.office,
  specialty: r.specialty, reason: r.reason, status: r.status,
  startsAt: r.starts_at, endsAt: r.ends_at, createdAt: r.created_at,
});

const SELECT_APPT = `SELECT a.*, d.name AS doctor_name, d.user_id AS doctor_user_id, d.office
                     FROM appointments a JOIN doctors d ON d.id = a.doctor_id`;

export async function createRepositories(databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id UUID PRIMARY KEY,
      user_id UUID,
      name TEXT NOT NULL,
      specialty TEXT NOT NULL,
      office TEXT,
      start_hour INT NOT NULL DEFAULT 9,
      end_hour INT NOT NULL DEFAULT 15,
      slot_minutes INT NOT NULL DEFAULT 30,
      work_days INT[] NOT NULL DEFAULT '{1,2,3,4,5}'
    );
    CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      patient_id UUID NOT NULL,
      patient_name TEXT,
      doctor_id UUID NOT NULL REFERENCES doctors(id),
      specialty TEXT,
      reason TEXT,
      status TEXT NOT NULL DEFAULT 'programada',
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    -- Evita que dos pacientes reserven el mismo horario del mismo médico
    CREATE UNIQUE INDEX IF NOT EXISTS uq_doctor_slot
      ON appointments (doctor_id, starts_at) WHERE status = 'programada';
    -- Médicos dados de baja por el admin (no se borran para conservar el historial)
    ALTER TABLE doctors ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
  `);

  for (const [id, userId, name, specialty, office, start, end] of DOCTORS) {
    await pool.query(
      `INSERT INTO doctors (id, user_id, name, specialty, office, start_hour, end_hour, work_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'{1,2,3,4,5,6}') ON CONFLICT (id) DO NOTHING`,
      [id, userId, name, specialty, office, start, end],
    );
  }

  const doctorRepo = {
    /** Solo médicos activos (lo que ven pacientes y el bot) */
    async list(specialty) {
      const { rows } = specialty
        ? await pool.query('SELECT * FROM doctors WHERE active AND lower(specialty)=lower($1) ORDER BY name', [specialty])
        : await pool.query('SELECT * FROM doctors WHERE active ORDER BY specialty, name');
      return rows.map(mapDoctor);
    },
    async specialties() {
      const { rows } = await pool.query('SELECT DISTINCT specialty FROM doctors WHERE active ORDER BY specialty');
      return rows.map((r) => r.specialty);
    },
    /** Todos, incluidos los dados de baja (para el admin) */
    async listAll() {
      const { rows } = await pool.query('SELECT * FROM doctors ORDER BY active DESC, specialty, name');
      return rows.map(mapDoctor);
    },
    async create(d) {
      const { rows } = await pool.query(
        `INSERT INTO doctors (id, user_id, name, specialty, office, start_hour, end_hour, slot_minutes, work_days)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [d.userId || null, d.name, d.specialty, d.office, d.startHour, d.endHour, d.slotMinutes, d.workDays]);
      return mapDoctor(rows[0]);
    },
    async update(id, d) {
      const cols = { userId: 'user_id', name: 'name', specialty: 'specialty', office: 'office', startHour: 'start_hour',
        endHour: 'end_hour', slotMinutes: 'slot_minutes', workDays: 'work_days', active: 'active' };
      const keys = Object.keys(d).filter((k) => cols[k] && d[k] !== undefined);
      if (!keys.length) return this.findById(id);
      const { rows } = await pool.query(
        `UPDATE doctors SET ${keys.map((k, i) => `${cols[k]}=$${i + 2}`).join(', ')} WHERE id=$1 RETURNING *`,
        [id, ...keys.map((k) => d[k])]);
      return mapDoctor(rows[0]);
    },
    async stats() {
      const { rows } = await pool.query('SELECT count(*) FILTER (WHERE active)::int AS activos, count(*)::int AS total FROM doctors');
      return rows[0];
    },
    async findById(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id || '')) return null;
      const { rows } = await pool.query('SELECT * FROM doctors WHERE id=$1', [id]);
      return mapDoctor(rows[0]);
    },
    async findByUserId(userId) {
      const { rows } = await pool.query('SELECT * FROM doctors WHERE user_id=$1', [userId]);
      return mapDoctor(rows[0]);
    },
  };

  const apptRepo = {
    async bookedStarts(doctorId, from, to) {
      const { rows } = await pool.query(
        `SELECT starts_at FROM appointments WHERE doctor_id=$1 AND status='programada'
         AND starts_at >= $2 AND starts_at < $3`, [doctorId, from, to]);
      return rows.map((r) => r.starts_at);
    },
    async create(a) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO appointments (patient_id, patient_name, doctor_id, specialty, reason, starts_at, ends_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [a.patientId, a.patientName, a.doctorId, a.specialty, a.reason, a.startsAt, a.endsAt]);
        return this.findById(rows[0].id);
      } catch (e) {
        if (e.code === '23505') throw new DomainError('Ese horario acaba de ser ocupado, elige otro', 409);
        throw e;
      }
    },
    async findById(id) {
      if (!/^[0-9a-f-]{36}$/i.test(id || '')) return null;
      const { rows } = await pool.query(`${SELECT_APPT} WHERE a.id=$1`, [id]);
      return mapAppt(rows[0]);
    },
    async listByPatient(patientId) {
      const { rows } = await pool.query(`${SELECT_APPT} WHERE a.patient_id=$1 ORDER BY a.starts_at DESC`, [patientId]);
      return rows.map(mapAppt);
    },
    async listByDoctor(doctorId) {
      const { rows } = await pool.query(`${SELECT_APPT} WHERE a.doctor_id=$1 ORDER BY a.starts_at ASC`, [doctorId]);
      return rows.map(mapAppt);
    },
    /** Admin: todas las citas con filtros opcionales */
    async listAll({ status, doctorId, patientId, from } = {}) {
      const where = [];
      const params = [];
      if (status) { params.push(status); where.push(`a.status=$${params.length}`); }
      if (doctorId) { params.push(doctorId); where.push(`a.doctor_id=$${params.length}`); }
      if (patientId) { params.push(patientId); where.push(`a.patient_id=$${params.length}`); }
      if (from) { params.push(from); where.push(`a.starts_at >= $${params.length}`); }
      const { rows } = await pool.query(
        `${SELECT_APPT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.starts_at DESC LIMIT 500`, params);
      return rows.map(mapAppt);
    },
    async futureByPatient(patientId) {
      const { rows } = await pool.query(`${SELECT_APPT} WHERE a.patient_id=$1 AND a.status='programada' AND a.starts_at > now()`, [patientId]);
      return rows.map(mapAppt);
    },
    async futureByDoctor(doctorId) {
      const { rows } = await pool.query(`${SELECT_APPT} WHERE a.doctor_id=$1 AND a.status='programada' AND a.starts_at > now()`, [doctorId]);
      return rows.map(mapAppt);
    },
    async remove(id) {
      await pool.query('DELETE FROM appointments WHERE id=$1', [id]);
    },
    async stats() {
      const { rows } = await pool.query(`
        SELECT count(*)::int AS total,
               count(*) FILTER (WHERE status='programada' AND starts_at > now())::int AS proximas,
               count(*) FILTER (WHERE status='cancelada')::int AS canceladas,
               count(*) FILTER (WHERE reason LIKE '%(vía Telegram)%')::int AS telegram,
               count(*) FILTER (WHERE starts_at::date = (now() AT TIME ZONE 'America/Mexico_City')::date)::int AS hoy
        FROM appointments`);
      const bySpec = await pool.query(`SELECT specialty, count(*)::int AS n FROM appointments GROUP BY specialty ORDER BY n DESC`);
      return { ...rows[0], porEspecialidad: bySpec.rows };
    },
    async update(id, f) {
      try {
        await pool.query(
          `UPDATE appointments SET
             status = COALESCE($2, status),
             starts_at = COALESCE($3, starts_at),
             ends_at = COALESCE($4, ends_at),
             updated_at = now()
           WHERE id=$1`, [id, f.status ?? null, f.startsAt ?? null, f.endsAt ?? null]);
      } catch (e) {
        if (e.code === '23505') throw new DomainError('Ese horario ya está ocupado, elige otro', 409);
        throw e;
      }
      return this.findById(id);
    },
  };

  return { doctorRepo, apptRepo };
}
