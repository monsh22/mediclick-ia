// Adaptador de RabbitMQ (infraestructura). Implementa el puerto "EventPublisher"
// y también permite consumir eventos. Reintenta la conexión si RabbitMQ aún no arranca.
import amqp from 'amqplib';

export const EXCHANGE = 'mediclick.events'; // exchange tipo "topic"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function connectRabbit(url, { serviceName = 'service', setup } = {}) {
  let channel = null;

  async function connect() {
    for (let attempt = 1; ; attempt++) {
      try {
        const conn = await amqp.connect(url, { clientProperties: { connection_name: serviceName } });
        conn.on('error', (e) => console.error(`[rabbit] error: ${e.message}`));
        conn.on('close', () => {
          console.warn('[rabbit] conexión cerrada, reconectando...');
          channel = null;
          setTimeout(() => connect().catch(() => {}), 3000);
        });
        const ch = await conn.createChannel();
        await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
        if (setup) await setup(ch);
        channel = ch;
        console.log(`[rabbit] ${serviceName} conectado a RabbitMQ`);
        return;
      } catch (e) {
        console.warn(`[rabbit] intento ${attempt} fallido (${e.message}). Reintentando en 3s...`);
        await sleep(3000);
      }
    }
  }

  await connect();

  return {
    /** Publica un evento de dominio. routingKey ej: "usuario.sesion_iniciada" */
    async publish(routingKey, data) {
      if (!channel) {
        console.warn(`[rabbit] sin canal, evento perdido: ${routingKey}`);
        return false;
      }
      const message = {
        event: routingKey,
        source: serviceName,
        occurredAt: new Date().toISOString(),
        data,
      };
      channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(message)), {
        persistent: true,
        contentType: 'application/json',
      });
      console.log(`[rabbit] -> ${routingKey}`);
      return true;
    },

    /** Crea una cola, la enlaza a varias routing keys y consume sus mensajes */
    async consume(queue, bindings, handler) {
      const wait = async () => {
        while (!channel) await sleep(500);
        return channel;
      };
      const ch = await wait();
      await ch.assertQueue(queue, { durable: true });
      for (const key of bindings) await ch.bindQueue(queue, EXCHANGE, key);
      await ch.prefetch(10);
      await ch.consume(queue, async (msg) => {
        if (!msg) return;
        try {
          const body = JSON.parse(msg.content.toString());
          await handler(body, msg.fields.routingKey);
          ch.ack(msg);
        } catch (e) {
          console.error(`[rabbit] error procesando ${msg.fields.routingKey}: ${e.message}`);
          ch.nack(msg, false, false); // descarta para no ciclar infinito
        }
      });
      console.log(`[rabbit] escuchando cola "${queue}" -> ${bindings.join(', ')}`);
    },
  };
}
