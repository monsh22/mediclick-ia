// ===== API GATEWAY =====
// Única puerta de entrada para la app móvil (puerto 8080).
// - Valida el token JWT
// - Limita peticiones (rate limit)
// - Redirige cada ruta al microservicio correcto
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import proxy from '@fastify/http-proxy';
import { readFile } from 'node:fs/promises';

const env = process.env;
const app = Fastify({ logger: { level: 'info' }, trustProxy: true });

await app.register(cors, { origin: true });
await app.register(rateLimit, { max: 120, timeWindow: '1 minute' });
await app.register(jwt, { secret: env.JWT_SECRET });

app.get('/health', async () => ({ ok: true, service: 'api-gateway', time: new Date().toISOString() }));

// Valida el token (excepto rutas públicas)
async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });
  }
}

// Solo administradores (rol "admin" dentro del token)
async function authenticateAdmin(request, reply) {
  try {
    await request.jwtVerify();
  } catch {
    return reply.code(401).send({ error: 'Sesión inválida o expirada. Inicia sesión de nuevo.' });
  }
  if (request.user?.role !== 'admin') {
    return reply.code(403).send({ error: 'Necesitas permisos de administrador.' });
  }
}

// Panel administrativo web: http://localhost:8080/admin
const adminHtml = new URL('./public/admin.html', import.meta.url);
app.get('/admin', async (_req, reply) => reply.type('text/html; charset=utf-8').send(await readFile(adminHtml, 'utf8')));
app.get('/', async (_req, reply) => reply.redirect('/admin'));

// Quitamos cualquier x-user-* que mande el cliente (anti suplantación)
// y agregamos los datos reales del token para los microservicios.
function userHeaders(request, headers) {
  const clean = Object.fromEntries(Object.entries(headers).filter(([k]) => !k.toLowerCase().startsWith('x-user-')));
  if (request.user) {
    clean['x-user-id'] = request.user.sub;
    clean['x-user-role'] = request.user.role;
    clean['x-user-name'] = encodeURIComponent(request.user.name || '');
  }
  clean['x-forwarded-for'] = request.ip;
  return clean;
}

const routes = [
  // [prefijo público, servicio, prefijo interno, requiere login]
  ['/api/auth', env.PATIENT_SERVICE_URL, '/auth', false],
  ['/api/patients', env.PATIENT_SERVICE_URL, '/patients', true],
  ['/api/doctors', env.APPOINTMENT_SERVICE_URL, '/doctors', true],
  ['/api/appointments', env.APPOINTMENT_SERVICE_URL, '/appointments', true],
  ['/api/notifications', env.NOTIFICATION_SERVICE_URL, '/notifications', true],
  ['/api/triage', env.TRIAGE_SERVICE_URL, '/triage', true],
  // Administración (solo rol admin)
  ['/api/admin/users', env.PATIENT_SERVICE_URL, '/admin/users', 'admin'],
  ['/api/admin/doctors', env.APPOINTMENT_SERVICE_URL, '/admin/doctors', 'admin'],
  ['/api/admin/appointments', env.APPOINTMENT_SERVICE_URL, '/admin/appointments', 'admin'],
  ['/api/admin/triage', env.TRIAGE_SERVICE_URL, '/admin/triage', 'admin'],
];

for (const [prefix, upstream, rewritePrefix, secured] of routes) {
  await app.register(proxy, {
    upstream,
    prefix,
    rewritePrefix,
    preHandler: secured === 'admin' ? authenticateAdmin : secured ? authenticate : undefined,
    replyOptions: { rewriteRequestHeaders: (request, headers) => userHeaders(request, headers) },
  });
}

await app.listen({ port: Number(env.PORT || 8080), host: '0.0.0.0' });
console.log('🚀 API Gateway listo en http://0.0.0.0:8080');
