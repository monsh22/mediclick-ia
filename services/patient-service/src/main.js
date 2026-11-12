// ===== COMPOSITION ROOT =====
// Aquí se "conectan" los adaptadores con los casos de uso (inyección de dependencias).
import { connectRabbit } from './infrastructure/messaging/rabbit.js';
import { createUserRepository } from './infrastructure/db/PostgresUserRepository.js';
import { bcryptHasher, jwtTokenService } from './infrastructure/security.js';
import { createServer } from './infrastructure/http/server.js';
import { makeUseCases } from './application/usecases.js';

const { PORT = 3001, DATABASE_URL, RABBITMQ_URL, JWT_SECRET } = process.env;

const events = await connectRabbit(RABBITMQ_URL, {
  serviceName: 'patient-service',
  // Cola de auditoría: guarda TODOS los inicios de sesión para verlos en el panel de RabbitMQ
  setup: async (ch) => {
    await ch.assertQueue('auditoria.sesiones', { durable: true });
    await ch.bindQueue('auditoria.sesiones', 'mediclick.events', 'usuario.#');
  },
});
const userRepo = await createUserRepository(DATABASE_URL);
const uc = makeUseCases({ userRepo, hasher: bcryptHasher, tokens: jwtTokenService(JWT_SECRET), events });

createServer(uc).listen(PORT, () => console.log(`patient-service escuchando en :${PORT}`));
