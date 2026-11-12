// ===== CASOS DE USO =====
// Puertos inyectados:
//   store      { push(userId, notif), list(userId) }                 (Redis)
//   scheduler  { schedule(jobId, delayMs, data), cancelFor(appointmentId) }  (BullMQ)
//   patients   { getTelegramChatId(userId) }                          (HTTP a patient-service)
//   n8n        { send(payload) }                                      (Webhook de n8n)
import { planReminders, buildMessage } from '../domain/notifications.js';

export function makeUseCases({ store, scheduler, patients, n8n, demo }) {
  async function notify(userId, event, data, extra = {}) {
    const msg = buildMessage(event, data, extra);
    if (!msg || !userId) return;
    const notif = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, event, ...msg, data, createdAt: new Date().toISOString(), read: false };
    await store.push(userId, notif);
    // Reenviamos a n8n para que mande Telegram (si el paciente vinculó su chat)
    const telegramChatId = await patients.getTelegramChatId(userId);
    await n8n.send({ event, userId, telegramChatId, text: `${msg.title}\n${msg.body}`, ...extra, data });
  }

  async function scheduleReminders(d) {
    for (const r of planReminders(d.startsAt, Date.now(), demo)) {
      await scheduler.schedule(`${d.appointmentId}-${r.kind}`, r.delay, { kind: r.kind, appointment: d });
      console.log(`[recordatorio] ${r.kind} programado para cita ${d.appointmentId} en ${Math.round(r.delay / 1000)}s`);
    }
  }

  return {
    /** Maneja cada evento que llega desde RabbitMQ */
    async handleEvent(message, routingKey) {
      const d = message.data || {};
      switch (routingKey) {
        case 'cita.creada':
          await notify(d.patientId, routingKey, d);
          await scheduleReminders(d);
          break;
        case 'cita.cancelada':
          await scheduler.cancelFor(d.appointmentId);
          await notify(d.patientId, routingKey, d);
          break;
        case 'cita.reagendada':
          await scheduler.cancelFor(d.appointmentId);
          await notify(d.patientId, routingKey, d);
          await scheduleReminders(d);
          break;
        case 'usuario.sesion_iniciada':
          await notify(d.userId, routingKey, d);
          break;
        case 'triaje.emergencia_detectada':
          if (d.userId) await notify(d.userId, routingKey, d);
          break;
        default:
          break;
      }
    },

    /** Lo ejecuta el worker cuando llega la hora de un recordatorio */
    async sendReminder({ kind, appointment }) {
      await notify(appointment.patientId, 'recordatorio', appointment, { kind });
    },

    list: (userId) => store.list(userId),
    markAllRead: (userId) => store.markAllRead(userId),
  };
}
