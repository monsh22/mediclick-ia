import express from 'express';

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);

function requireUser(req, res, next) {
  const id = req.header('x-user-id');
  if (!id) return res.status(401).json({ error: 'No autenticado' });
  req.user = { id, role: req.header('x-user-role') };
  next();
}

export function createServer(uc) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'notification-service' }));
  app.get('/notifications/me', requireUser, wrap(async (req, res) => res.json(await uc.list(req.user.id))));
  app.post('/notifications/me/read', requireUser, wrap(async (req, res) => res.json(await uc.markAllRead(req.user.id))));
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });
  return app;
}
