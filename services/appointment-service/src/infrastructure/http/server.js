// Adaptador de entrada: API REST
import express from 'express';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function requireUser(req, res, next) {
  const id = req.header('x-user-id');
  if (!id) return res.status(401).json({ error: 'No autenticado' });
  req.user = { id, role: req.header('x-user-role'), name: decodeURIComponent(req.header('x-user-name') || '') };
  next();
}

function requireAdmin(req, res, next) {
  requireUser(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
    next();
  });
}

export function createServer(uc, tg, adm) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'appointment-service' }));

  // ---------- API pública (la usa la app a través del Gateway) ----------
  app.get('/doctors', requireUser, wrap(async (req, res) => res.json(await uc.listDoctors(req.query.specialty))));
  app.get('/doctors/specialties', requireUser, wrap(async (_req, res) => res.json(await uc.listSpecialties())));
  app.get('/doctors/:id/slots', requireUser, wrap(async (req, res) => res.json(await uc.getSlots(req.params.id, req.query.date))));

  app.post('/appointments', requireUser, wrap(async (req, res) => res.status(201).json(await uc.book(req.user, req.body))));
  app.get('/appointments/me', requireUser, wrap(async (req, res) => res.json(await uc.myAppointments(req.user))));
  app.patch('/appointments/:id/cancel', requireUser, wrap(async (req, res) => res.json(await uc.cancel(req.user, req.params.id))));
  app.patch('/appointments/:id/reschedule', requireUser, wrap(async (req, res) => res.json(await uc.reschedule(req.user, req.params.id, req.body))));

  // ---------- Administración (gateway: /api/admin/doctors y /api/admin/appointments) ----------
  app.get('/admin/doctors', requireAdmin, wrap(async (_req, res) => res.json(await adm.listDoctors())));
  app.post('/admin/doctors', requireAdmin, wrap(async (req, res) => res.status(201).json(await adm.createDoctor(req.user.id, req.body))));
  app.put('/admin/doctors/:id', requireAdmin, wrap(async (req, res) => res.json(await adm.updateDoctor(req.user.id, req.params.id, req.body))));
  app.delete('/admin/doctors/:id', requireAdmin, wrap(async (req, res) => res.json(await adm.deactivateDoctor(req.user.id, req.params.id))));
  app.get('/admin/appointments/stats', requireAdmin, wrap(async (_req, res) => res.json(await adm.stats())));
  app.get('/admin/appointments', requireAdmin, wrap(async (req, res) => res.json(await adm.listAppointments(req.query))));
  app.patch('/admin/appointments/:id/cancel', requireAdmin, wrap(async (req, res) => res.json(await adm.cancelAppointment(req.user.id, req.params.id))));
  app.delete('/admin/appointments/:id', requireAdmin, wrap(async (req, res) => res.json(await adm.deleteAppointment(req.user.id, req.params.id))));

  // ---------- API interna (solo red de Docker; la usa el asistente de n8n/Telegram) ----------
  // El Gateway NO expone /internal, así que nadie de afuera puede llamarla.
  // Responde siempre 200 con { ok:false, error } para que la IA pueda leer el error y explicarlo.
  const internal = express.Router();
  const iwrap = (fn) => async (req, res) => {
    try {
      res.json(await fn(req));
    } catch (e) {
      if (!e.status) console.error(e);
      res.json({ ok: false, error: e.status ? e.message : 'Error interno, intenta de nuevo' });
    }
  };
  internal.get('/specialties', iwrap(async () => ({ especialidades: await tg.specialties() })));
  internal.get('/doctors', iwrap((req) => tg.doctors(req.query.specialty)));
  internal.get('/availability', iwrap((req) => tg.availability({ specialty: req.query.specialty, date: req.query.date })));
  internal.post('/appointments', iwrap((req) => tg.book(req.body)));
  internal.get('/patients/:patientId/appointments', iwrap((req) => tg.myAppointments(req.params.patientId)));
  internal.post('/appointments/:id/cancel', iwrap((req) => tg.cancel({ patientId: req.body.patientId, appointmentId: req.params.id })));
  internal.post('/appointments/:id/reschedule', iwrap((req) => tg.reschedule({ ...req.body, appointmentId: req.params.id })));
  app.use('/internal', internal);

  app.use((err, _req, res, _next) => {
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno del servidor' });
  });
  return app;
}
