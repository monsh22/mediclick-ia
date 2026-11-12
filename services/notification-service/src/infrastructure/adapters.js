// Adaptadores de salida: Redis (almacén), BullMQ (programador), HTTP (paciente y n8n)
import IORedis from 'ioredis';
import { Queue, Worker } from 'bullmq';

const QUEUE = 'recordatorios';

export function createRedisStore(redisUrl) {
  const redis = new IORedis(redisUrl);
  const key = (u) => `notif:${u}`;
  return {
    async push(userId, n) {
      await redis.lpush(key(userId), JSON.stringify(n));
      await redis.ltrim(key(userId), 0, 49); // guardamos las últimas 50
    },
    async list(userId) {
      return (await redis.lrange(key(userId), 0, 49)).map((s) => JSON.parse(s));
    },
    async markAllRead(userId) {
      const items = (await this.list(userId)).map((n) => ({ ...n, read: true }));
      const multi = redis.multi().del(key(userId));
      if (items.length) multi.rpush(key(userId), ...items.map((n) => JSON.stringify(n)));
      await multi.exec();
      return { ok: true };
    },
  };
}

export function createScheduler(redisUrl, onReminder) {
  const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE, { connection });

  new Worker(QUEUE, async (job) => onReminder(job.data), { connection })
    .on('failed', (job, e) => console.error(`[recordatorio] falló ${job?.id}: ${e.message}`));

  return {
    async schedule(jobId, delay, data) {
      const old = await queue.getJob(jobId);
      if (old) await old.remove().catch(() => {});
      await queue.add('recordatorio', data, { jobId, delay, removeOnComplete: true, removeOnFail: 100 });
    },
    async cancelFor(appointmentId) {
      for (const kind of ['24h', '2h']) {
        const job = await queue.getJob(`${appointmentId}-${kind}`);
        if (job) await job.remove().catch(() => {});
      }
    },
  };
}

export function createPatientClient(baseUrl) {
  return {
    async getTelegramChatId(userId) {
      try {
        const r = await fetch(`${baseUrl}/internal/patients/${userId}`);
        if (!r.ok) return null;
        return (await r.json()).telegramChatId || null;
      } catch {
        return null;
      }
    },
  };
}

export function createN8nClient(webhookUrl) {
  return {
    async send(payload) {
      if (!webhookUrl) return;
      try {
        const r = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) console.warn(`[n8n] webhook respondió ${r.status} (¿activaste el workflow?)`);
      } catch (e) {
        console.warn(`[n8n] no disponible: ${e.message}`);
      }
    },
  };
}
