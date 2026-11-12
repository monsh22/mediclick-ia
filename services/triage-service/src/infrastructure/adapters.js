// Adaptadores de salida: pgvector (RAG + historial) y LLM (Claude por API)
import pg from 'pg';
import { KNOWLEDGE } from '../domain/knowledge.js';
import { embed, toPgVector, DIMS } from '../domain/embedding.js';

export async function createPgAdapters(databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS vector;
    DROP TABLE IF EXISTS knowledge_chunks; -- se re-indexa en cada arranque
    CREATE TABLE knowledge_chunks (
      id SERIAL PRIMARY KEY,
      specialty TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding vector(${DIMS})
    );
    CREATE TABLE IF NOT EXISTS triage_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      channel TEXT,
      message TEXT,
      reply TEXT,
      specialty TEXT,
      emergency BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Indexar la base de conocimiento
  for (const k of KNOWLEDGE) {
    await pool.query(
      'INSERT INTO knowledge_chunks (specialty, title, content, embedding) VALUES ($1,$2,$3,$4)',
      [k.specialty, k.title, k.content, toPgVector(embed(`${k.title} ${k.content}`))],
    );
  }
  console.log(`[rag] ${KNOWLEDGE.length} documentos indexados en pgvector`);

  return {
    knowledge: {
      async search(text, k = 3) {
        // <=> = distancia coseno de pgvector (0 = idéntico)
        const { rows } = await pool.query(
          `SELECT specialty, title, content, 1 - (embedding <=> $1) AS score
           FROM knowledge_chunks ORDER BY embedding <=> $1 LIMIT $2`,
          [toPgVector(embed(text)), k],
        );
        return rows.map((r) => ({ ...r, score: Number(r.score) || 0 }));
      },
    },
    sessions: {
      async list({ emergency, channel, userId, limit = 200 } = {}) {
        const where = [];
        const params = [];
        if (emergency === 'true' || emergency === true) where.push('emergency = true');
        if (channel) { params.push(channel); where.push(`channel=$${params.length}`); }
        if (userId && /^[0-9a-f-]{36}$/i.test(userId)) { params.push(userId); where.push(`user_id=$${params.length}`); }
        params.push(Math.min(Number(limit) || 200, 500));
        const { rows } = await pool.query(
          `SELECT id, user_id AS "userId", channel, message, reply, specialty, emergency, created_at AS "createdAt"
           FROM triage_sessions ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
           ORDER BY created_at DESC LIMIT $${params.length}`, params);
        return rows;
      },
      async stats() {
        const { rows } = await pool.query(`
          SELECT count(*)::int AS total,
                 count(*) FILTER (WHERE emergency)::int AS emergencias,
                 count(*) FILTER (WHERE channel='telegram')::int AS telegram,
                 count(*) FILTER (WHERE channel='app')::int AS app
          FROM triage_sessions`);
        const top = await pool.query(`SELECT specialty, count(*)::int AS n FROM triage_sessions
                                      WHERE specialty IS NOT NULL GROUP BY specialty ORDER BY n DESC LIMIT 6`);
        return { ...rows[0], especialidadesSugeridas: top.rows };
      },
      async save({ userId, channel, message, reply, specialty, emergency }) {
        const uid = /^[0-9a-f-]{36}$/i.test(userId || '') ? userId : null;
        await pool.query(
          'INSERT INTO triage_sessions (user_id, channel, message, reply, specialty, emergency) VALUES ($1,$2,$3,$4,$5,$6)',
          [uid, channel, message, reply, specialty, emergency],
        );
      },
    },
  };
}

/** Adaptador para Claude (Anthropic Messages API). Si no hay API key, available=false */
export function createClaudeLLM(apiKey, model) {
  if (!apiKey) return { available: false };
  return {
    available: true,
    async complete({ system, messages }) {
      // La API exige empezar con "user" y alternar roles
      const clean = [];
      for (const m of messages) {
        const role = m.role === 'assistant' ? 'assistant' : 'user';
        if (!clean.length && role === 'assistant') continue;
        if (clean.length && clean[clean.length - 1].role === role) clean[clean.length - 1].content += `\n${m.content}`;
        else clean.push({ role, content: String(m.content) });
      }
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 1200, system, messages: clean }),
      });
      if (!r.ok) throw new Error(`API ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const data = await r.json();
      return data.content?.map((c) => c.text || '').join('') || '';
    },
  };
}

/**
 * Adaptador para APIs compatibles con OpenAI: Groq (gratis) o Grok de xAI.
 * Mismo puerto que Claude: { available, complete({ system, messages }) }
 */
export function createOpenAICompatLLM(baseUrl, apiKey, model) {
  if (!apiKey) return { available: false };
  return {
    available: true,
    async complete({ system, messages }) {
      const body = {
        model,
        temperature: 0.3,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          ...messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content) })),
        ],
      };
      const send = (b) => fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(b),
      });
      let r = await send(body);
      // Algunos modelos no aceptan "response_format": reintentamos sin él
      if (r.status === 400) {
        const { response_format, ...plain } = body;
        r = await send(plain);
      }
      if (!r.ok) throw new Error(`API ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const data = await r.json();
      return data.choices?.[0]?.message?.content || '';
    },

    /** Una vuelta del agente: el modelo responde texto o pide usar herramientas */
    async chatWithTools({ messages, tools }) {
      const send = () => fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, temperature: 0.3, max_tokens: 1400, messages, tools, tool_choice: 'auto' }),
      });
      let r = await send();
      // A veces el modelo arma mal una llamada (Groq responde 400 "tool_use_failed"): reintentamos una vez
      if (r.status === 400) r = await send();
      if (!r.ok) throw new Error(`API ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const msg = (await r.json()).choices?.[0]?.message || {};
      return { content: msg.content || '', tool_calls: msg.tool_calls || [] };
    },
  };
}
