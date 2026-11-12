// ===== CASO DE USO: conversación de triaje =====
// Puertos inyectados:
//   knowledge { search(text, k) -> [{ specialty, title, content, score }] }   (pgvector)
//   llm       { available, complete({ system, messages }) -> string }         (Claude o null)
//   sessions  { save(record) }
//   events    { publish(routingKey, data) }
import { detectEmergency, DISCLAIMER } from '../domain/redFlags.js';
import { SPECIALTIES } from '../domain/knowledge.js';
import { DomainError } from '../domain/errors.js';

const SYSTEM_PROMPT = (context) => `Eres Medi 🩺✨, la asistente de triaje de "MediClick AI", una clínica en México.
Tu tarea: entender el motivo de consulta y orientar sobre la especialidad adecuada, de forma EMPÁTICA y DIDÁCTICA
(explicas las cosas con palabras sencillas, como una buena enfermera que enseña).

La conversación tiene 2 FASES:

FASE 1 · "preguntas" (cuando falta información; normalmente el primer mensaje):
- Empieza con 1 frase empática ("¡Hola! Lamento que estés pasando por...").
- Luego escribe "Para orientarte mejor, necesito conocer un poco más:" y haz de 3 a 6 preguntas NUMERADAS (1., 2., 3.),
  cortas y con ejemplos entre paréntesis. Elige las preguntas según el síntoma: duración, intensidad del 1 al 10,
  si es constante o intermitente, zona exacta, qué lo empeora o alivia, otros síntomas acompañantes,
  si ya tomó algo y si le ayudó, y edad si podría tratarse de un niño o adulto mayor.

FASE 2 · "recomendacion" (cuando ya hay suficiente información, normalmente tras su respuesta):
Usa este formato con saltos de línea:
"📝 Lo que me contaste: (resumen en 1 línea)
🩺 Te recomiendo: **Especialidad**
💡 ¿Por qué?: (1-2 oraciones sencillas explicando qué atiende esa especialidad y por qué encaja)
📋 En la consulta: (qué suele pasar: preguntas, exploración, posibles estudios)
🏠 Mientras tanto: (1-2 cuidados generales SIN medicamentos: descanso, hidratación, evitar lo que empeora)
⚠️ Ve a urgencias si: (2-3 señales de alarma relacionadas)"

Reglas:
- NUNCA des diagnósticos, ni recetes medicamentos o dosis.
- Si detectas cualquier señal de emergencia, indica llamar al 911 y pon "urgencia":"alta".
- Elige la especialidad SOLO de esta lista: ${SPECIALTIES.join(', ')}.
- Si no es un tema de salud, responde amablemente que solo puedes ayudar con síntomas y citas.
- Responde en español.
- "sugerencias": 2 a 4 respuestas cortas (máx. 5 palabras) que el paciente podría tocar como botón.
  En fase 1, posibles respuestas a tus preguntas (ej. "Desde hace 2 días", "Intensidad 7 de 10").
  En fase 2, siguientes pasos (ej. "Ver horarios", "Tengo otra duda").

Información de la clínica (RAG):
${context}

Responde SOLO con JSON válido con esta forma:
{"fase":"preguntas|recomendacion","respuesta":"texto para el paciente","especialidad":"una de la lista o null","urgencia":"baja|media|alta","sugerencias":["...","..."]}`;

/** Preguntas didácticas para el modo local (sin LLM) */
const LOCAL_QUESTIONS = [
  '1. ¿Desde cuándo tienes la molestia? (horas, días, semanas)',
  '2. Del 1 al 10, ¿qué tan fuerte es?',
  '3. ¿Es constante o va y viene?',
  '4. ¿Tienes otros síntomas? (fiebre, náuseas, mareo, tos…)',
  '5. ¿Ya tomaste algo? ¿Te ayudó?',
];

function localReply({ docs, isFirst }) {
  const best = docs[0];
  const known = best && best.score > 0.12;
  if (isFirst) {
    return {
      fase: 'preguntas',
      respuesta: `¡Hola! Lamento que te sientas así 💙 Para orientarte mejor, necesito conocer un poco más:\n\n${LOCAL_QUESTIONS.join('\n')}`
        + (known ? `\n\nPor lo que cuentas, podría tratarse de algo de **${best.specialty}**, pero confirmémoslo con tus respuestas.` : ''),
      especialidad: null,
      urgencia: 'baja',
      sugerencias: ['Desde ayer', 'Intensidad 6 de 10', 'También tengo fiebre', 'No he tomado nada'],
    };
  }
  const spec = known ? best.specialty : 'Medicina General';
  const why = known
    ? `Esta especialidad atiende: ${best.content.split(',').slice(0, 4).join(',').toLowerCase()}…`
    : 'Es el mejor primer paso cuando no está claro el origen de la molestia: el médico general te revisa y, si hace falta, te canaliza.';
  return {
    fase: 'recomendacion',
    respuesta:
      `🩺 Te recomiendo: **${spec}**\n` +
      `💡 ¿Por qué?: ${why}\n` +
      '📋 En la consulta: el médico te hará preguntas, te revisará y, si lo necesita, pedirá estudios.\n' +
      '🏠 Mientras tanto: descansa, hidrátate y anota cuándo empeora la molestia.\n' +
      '⚠️ Ve a urgencias si: el dolor se vuelve insoportable, tienes fiebre muy alta o te cuesta respirar.',
    especialidad: spec,
    urgencia: 'baja',
    sugerencias: ['Ver horarios', 'Tengo otra duda'],
  };
}

function parseJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/**
 * Revisión rápida de emergencias (sin IA). La usa el asistente de Telegram
 * ANTES de pasarle el mensaje al AI Agent: si hay alarma, se responde con el 911 y se detiene.
 */
export function makeEmergencyCheck({ sessions, events }) {
  return async function checkEmergency({ userId = null, channel = 'telegram', message = '' }) {
    const emergency = detectEmergency(message);
    if (!emergency) return { emergency: false };
    await sessions.save({ userId, channel, message, reply: emergency.reply, specialty: null, emergency: true });
    await events.publish('triaje.emergencia_detectada', { userId, channel, flags: emergency.flags, type: emergency.type, message });
    return { emergency: true, emergencyType: emergency.type, flags: emergency.flags, reply: emergency.reply.replaceAll('**', '') };
  };
}

export function makeTriage({ knowledge, llm, sessions, events }) {
  return async function triageChat({ userId = null, channel = 'app', message, history = [] }) {
    if (!message || !message.trim()) throw new DomainError('Escribe tus síntomas o motivo de consulta', 400);

    // 1) Reglas de seguridad primero: síntomas de alarma -> 911
    const emergency = detectEmergency(message);
    if (emergency) {
      await sessions.save({ userId, channel, message, reply: emergency.reply, specialty: null, emergency: true });
      await events.publish('triaje.emergencia_detectada', { userId, channel, flags: emergency.flags, type: emergency.type, message });
      return { emergency: true, emergencyType: emergency.type, flags: emergency.flags, reply: emergency.reply, specialty: null, urgency: 'alta', callNumber: '911' };
    }

    // 2) RAG: buscar en la base de conocimiento lo más parecido
    const recentText = [...history.filter((h) => h.role === 'user').slice(-3).map((h) => h.content), message].join(' ');
    const docs = await knowledge.search(recentText, 3);
    const context = docs.map((d) => `- [${d.specialty}] ${d.title}: ${d.content}`).join('\n');

    // 3) LLM (si hay API key) o modo local
    let result = null;
    if (llm.available) {
      try {
        const raw = await llm.complete({
          system: SYSTEM_PROMPT(context),
          messages: [...history.slice(-8), { role: 'user', content: message }],
        });
        result = parseJson(raw);
      } catch (e) {
        console.warn(`[llm] falló, usando modo local: ${e.message}`);
      }
    }
    if (!result || !result.respuesta) {
      const isFirst = !history.some((h) => h.role === 'user');
      result = localReply({ docs, isFirst });
    }

    // La IA también puede marcar urgencia alta
    if (result.urgencia === 'alta') {
      await events.publish('triaje.emergencia_detectada', { userId, channel, flags: ['IA: urgencia alta'], type: 'fisica', message });
    }

    const specialty = SPECIALTIES.includes(result.especialidad) ? result.especialidad : null;
    const fase = result.fase === 'preguntas' ? 'preguntas' : 'recomendacion';
    // El aviso legal solo al recomendar (en las preguntas estorba)
    const reply = fase === 'recomendacion' ? `${result.respuesta}\n\n${DISCLAIMER}` : result.respuesta;
    const sugerencias = (Array.isArray(result.sugerencias) ? result.sugerencias : [])
      .map((x) => String(x).trim()).filter((x) => x && x.length <= 40).slice(0, 4);
    await sessions.save({ userId, channel, message, reply, specialty, emergency: result.urgencia === 'alta' });
    await events.publish('triaje.completado', { userId, channel, specialty, urgency: result.urgencia, mode: llm.available ? 'llm' : 'local' });

    return {
      emergency: result.urgencia === 'alta',
      reply,
      phase: fase,
      suggestions: sugerencias,
      specialty: fase === 'recomendacion' ? specialty : null,
      tentativeSpecialty: specialty,
      urgency: result.urgencia,
      callNumber: result.urgencia === 'alta' ? '911' : null,
      sources: docs.map((d) => ({ specialty: d.specialty, title: d.title, score: +d.score.toFixed(3) })),
      mode: llm.available ? 'llm' : 'local',
    };
  };
}
