// ===== COMPOSITION ROOT =====
import { connectRabbit } from './infrastructure/messaging/rabbit.js';
import { createRedisStore, createScheduler, createPatientClient, createN8nClient } from './infrastructure/adapters.js';
import { createServer } from './infrastructure/http/server.js';
import { makeUseCases } from './application/usecases.js';

const { PORT = 3003, RABBITMQ_URL, REDIS_URL, PATIENT_SERVICE_URL, N8N_WEBHOOK_URL, DEMO_FAST_REMINDERS } = process.env;

let uc;
const scheduler = createScheduler(REDIS_URL, (data) => uc.sendReminder(data));
uc = makeUseCases({
  store: createRedisStore(REDIS_URL),
  scheduler,
  patients: createPatientClient(PATIENT_SERVICE_URL),
  n8n: createN8nClient(N8N_WEBHOOK_URL),
  demo: DEMO_FAST_REMINDERS === 'true',
});

const bus = await connectRabbit(RABBITMQ_URL, { serviceName: 'notification-service' });
await bus.consume(
  'notificaciones.eventos',
  ['cita.*', 'usuario.sesion_iniciada', 'triaje.emergencia_detectada'],
  (msg, key) => uc.handleEvent(msg, key),
);

createServer(uc).listen(PORT, () => console.log(`notification-service escuchando en :${PORT}`));
