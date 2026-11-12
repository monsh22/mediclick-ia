import express from 'express';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

export function createServer(triageChat, checkEmergency, sessions, assistantChat) {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'triage-service' }));

  // Desde la app (pasa por el gateway, que agrega x-user-id)
  app.post('/triage/chat', wrap(async (req, res) => {
    const userId = req.header('x-user-id');
    if (!userId) return res.status(401).json({ error: 'No autenticado' });
    res.json(await triageChat({ userId, channel: 'app', message: req.body.message, history: req.body.history || [] }));
  }));

  // Medi (agente con herramientas) desde la app
  app.post('/triage/assistant', wrap(async (req, res) => {
    const id = req.header('x-user-id');
    if (!id) return res.status(401).json({ error: 'No autenticado' });
    const user = { id, role: req.header('x-user-role'), name: decodeURIComponent(req.header('x-user-name') || '') };
    res.json(await assistantChat({ user, message: req.body.message, history: req.body.history || [] }));
  }));

  // Desde n8n / Telegram (solo red interna de Docker)
  app.post('/internal/triage/chat', wrap(async (req, res) => {
    res.json(await triageChat({ userId: req.body.userId || null, channel: req.body.channel || 'telegram', message: req.body.message, history: [] }));
  }));

  // Filtro de emergencias (911) que n8n consulta antes del AI Agent
  app.post('/internal/triage/check', wrap(async (req, res) => {
    res.json(await checkEmergency({ userId: req.body.userId || null, channel: req.body.channel || 'telegram', message: req.body.message || '' }));
  }));

  // Administración: conversaciones y emergencias (gateway: /api/admin/triage)
  const requireAdmin = (req, res, next) =>
    req.header('x-user-role') === 'admin' ? next() : res.status(403).json({ error: 'Solo administradores' });
  app.get('/admin/triage/stats', requireAdmin, wrap(async (_req, res) => res.json(await sessions.stats())));
  app.get('/admin/triage/sessions', requireAdmin, wrap(async (req, res) => res.json(await sessions.list(req.query))));

  app.use((err, _req, res, _next) => {
    if (!err.status) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno del servidor' });
  });
  return app;
}
