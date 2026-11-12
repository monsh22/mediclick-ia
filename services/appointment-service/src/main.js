// ===== COMPOSITION ROOT =====
import { connectRabbit } from './infrastructure/messaging/rabbit.js';
import { createRepositories } from './infrastructure/db/postgres.js';
import { createServer } from './infrastructure/http/server.js';
import { makeUseCases } from './application/usecases.js';
import { makeTelegramUseCases } from './application/telegramUsecases.js';
import { makeAdminUseCases } from './application/adminUsecases.js';

const { PORT = 3002, DATABASE_URL, RABBITMQ_URL, TZ_OFFSET = '-06:00' } = process.env;

const events = await connectRabbit(RABBITMQ_URL, {
  serviceName: 'appointment-service',
  setup: async (ch) => {
    // Cola de auditoría para ver en el panel todas las citas creadas/canceladas/reagendadas
    await ch.assertQueue('auditoria.citas', { durable: true });
    await ch.bindQueue('auditoria.citas', 'mediclick.events', 'cita.#');
  },
});
const { doctorRepo, apptRepo } = await createRepositories(DATABASE_URL);
const uc = makeUseCases({ doctorRepo, apptRepo, events, offset: TZ_OFFSET });
const tg = makeTelegramUseCases({ uc, doctorRepo, apptRepo, offset: TZ_OFFSET });
const adm = makeAdminUseCases({ uc, doctorRepo, apptRepo, events });

// Arquitectura dirigida por eventos: si el admin elimina un usuario en patient-service,
// este servicio se entera por RabbitMQ y cancela sus citas futuras.
await events.consume('citas.usuarios', ['usuario.eliminado'], (msg) => adm.onUserDeleted(msg.data || {}));

createServer(uc, tg, adm).listen(PORT, () => console.log(`appointment-service escuchando en :${PORT}`));
