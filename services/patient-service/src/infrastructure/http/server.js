// Adaptador de entrada: API REST con Express
import express from 'express';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

/** El API Gateway valida el JWT y nos manda el usuario en estas cabeceras */
function requireUser(req, res, next) {
  const id = req.header('x-user-id');
  if (!id) return res.status(401).json({ error: 'No autenticado' });
  req.user = { id, role: req.header('x-user-role'), name: decodeURIComponent(req.header('x-user-name') || '') };
  next();
}

/** Doble candado: el gateway ya revisa el rol, pero el servicio lo vuelve a revisar */
function requireAdmin(req, res, next) {
  requireUser(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo administradores' });
    next();
  });
}

export function createServer(uc) {
  const app = express();
  app.use(express.json());

  const meta = (req) => ({
    ip: req.header('x-forwarded-for') || req.ip,
    userAgent: req.header('user-agent'),
  });

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'patient-service' }));

  // Públicas (el gateway no pide token)
  app.post('/auth/register', wrap(async (req, res) => res.status(201).json(await uc.register(req.body, meta(req)))));
  app.post('/auth/login', wrap(async (req, res) => res.json(await uc.login(req.body, meta(req)))));

  // Protegidas
  app.get('/patients/me', requireUser, wrap(async (req, res) => res.json(await uc.getProfile(req.user.id))));
  app.put('/patients/me', requireUser, wrap(async (req, res) => res.json(await uc.updateProfile(req.user.id, req.body))));

  // Administración (gateway: /api/admin/users -> /admin/users)
  app.get('/admin/users/stats', requireAdmin, wrap(async (_req, res) => res.json(await uc.admin.stats())));
  app.get('/admin/users', requireAdmin, wrap(async (req, res) => res.json(await uc.admin.list(req.query))));
  app.get('/admin/users/:id', requireAdmin, wrap(async (req, res) => res.json(await uc.getProfile(req.params.id))));
  app.post('/admin/users', requireAdmin, wrap(async (req, res) => res.status(201).json(await uc.admin.create(req.user.id, req.body))));
  app.put('/admin/users/:id', requireAdmin, wrap(async (req, res) => res.json(await uc.admin.update(req.user.id, req.params.id, req.body))));
  app.post('/admin/users/:id/password', requireAdmin, wrap(async (req, res) => res.json(await uc.admin.setPassword(req.user.id, req.params.id, req.body.password))));
  app.delete('/admin/users/:id', requireAdmin, wrap(async (req, res) => res.json(await uc.admin.remove(req.user.id, req.params.id))));

  // Internas (solo dentro de la red de Docker, el gateway NO las expone)
  app.get('/internal/patients/:id', wrap(async (req, res) => res.json(await uc.getProfile(req.params.id))));
  app.post('/internal/patients/telegram', wrap(async (req, res) => res.json(await uc.identifyTelegram(req.body))));

  // Expediente desde Telegram: responde siempre 200 para que la IA pueda leer el error
  app.get('/internal/patients/:id/record', async (req, res) => {
    try {
      const p = await uc.getProfile(req.params.id);
      res.json({
        ok: true,
        nombre: p.name, telefono: p.phone, fechaNacimiento: p.birthDate, tipoSangre: p.bloodType,
        alergias: p.allergies, enfermedadesCronicas: p.chronicConditions, medicamentosActuales: p.currentMedications,
        contactoEmergencia: p.emergencyContact,
        nota: 'Los campos en null aún no se han registrado.',
      });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });
  app.post('/internal/patients/:id/record', async (req, res) => {
    try {
      const b = req.body || {};
      const p = await uc.updateProfile(req.params.id, {
        name: b.nombre, phone: b.telefono, birthDate: b.fechaNacimiento, bloodType: b.tipoSangre,
        allergies: b.alergias, chronicConditions: b.enfermedadesCronicas,
        currentMedications: b.medicamentosActuales, emergencyContact: b.contactoEmergencia,
      }, { channel: 'telegram', skipEmpty: true });
      res.json({ ok: true, mensaje: 'Expediente actualizado', alergias: p.allergies, tipoSangre: p.bloodType, enfermedadesCronicas: p.chronicConditions, medicamentosActuales: p.currentMedications });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.use((err, _req, res, _next) => {
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno del servidor' });
  });
  return app;
}
