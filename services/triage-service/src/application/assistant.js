// ===== CASO DE USO: Medi, asistente con herramientas (app) =====
// Es el mismo "agente" que en Telegram (n8n), pero programado aquí:
//   el LLM (Groq) decide qué herramienta usar → ejecutamos la herramienta
//   (llamando a los microservicios) → le devolvemos el resultado → responde.
// Además devolvemos "tarjetas" para que la app las dibuje con botones.
//
// Puertos inyectados:
//   llm        { available, chatWithTools({ messages, tools }) -> { content, tool_calls } }
//   clinic     { doctors, availability, book, myAppointments, cancel, reschedule, record, updateRecord }
//   knowledge  { search(text, k) }             (RAG con pgvector)
//   sessions   { save(record) }
//   events     { publish(routingKey, data) }
//   fallback   triageChat(...)                 (si no hay LLM o falla)
import { detectEmergency, DISCLAIMER } from '../domain/redFlags.js';
import { SPECIALTIES } from '../domain/knowledge.js';
import { DomainError } from '../domain/errors.js';

const TZ = 'America/Mexico_City';
const MAX_STEPS = 6;

// ---------- Herramientas que el LLM puede usar (formato OpenAI / Groq) ----------
const fn = (name, description, properties = {}, required = []) => ({
  type: 'function',
  function: { name, description, parameters: { type: 'object', properties, required } },
});
const str = (description) => ({ type: 'string', description });

export const TOOLS = [
  fn('buscar_especialidad', 'Busca en la base de conocimiento de la clínica (RAG) qué especialidades atienden los síntomas descritos. Úsala cuando ya tengas suficiente información de los síntomas.',
    { sintomas: str('Resumen de los síntomas del paciente') }, ['sintomas']),
  fn('ver_medicos', 'Directorio de médicos con especialidad, consultorio, horario y días. Puede filtrar por especialidad.',
    { especialidad: str('Especialidad a filtrar; vacío para todos') }),
  fn('ver_disponibilidad', 'Horarios LIBRES de una especialidad. Sin fecha devuelve los próximos 3 días con lugar. La app mostrará los horarios como botones.',
    { especialidad: str('Especialidad, ej. Cardiología'), fecha: str('Fecha AAAA-MM-DD o vacío') }, ['especialidad']),
  fn('agendar_cita', 'Agenda la cita. Úsala SOLO después de que el paciente confirme especialidad, médico, día y hora.',
    { medico: str('doctorId o nombre del médico'), fecha: str('AAAA-MM-DD'), hora: str('HH:MM en 24 h'), motivo: str('Resumen breve de los síntomas para el médico') },
    ['medico', 'fecha', 'hora']),
  fn('mis_citas', 'Lista las próximas citas del paciente con su citaId.'),
  fn('cancelar_cita', 'Cancela una cita. Usa primero mis_citas para obtener el citaId y confirma con el paciente.',
    { citaId: str('citaId de mis_citas') }, ['citaId']),
  fn('reagendar_cita', 'Cambia fecha y hora de una cita (mismo médico).',
    { citaId: str('citaId de mis_citas'), fecha: str('Nueva fecha AAAA-MM-DD'), hora: str('Nueva hora HH:MM') }, ['citaId', 'fecha', 'hora']),
  fn('ver_expediente', 'Muestra el expediente del paciente: alergias, tipo de sangre, enfermedades crónicas, medicamentos, etc.'),
  fn('actualizar_expediente', 'Guarda datos del expediente. Llena SOLO lo que el paciente dijo.', {
    alergias: str('Alergias'), tipoSangre: str('Ej. O+'), enfermedadesCronicas: str('Ej. diabetes'),
    medicamentosActuales: str('Medicamentos que toma'), telefono: str('Teléfono'),
    fechaNacimiento: str('AAAA-MM-DD'), contactoEmergencia: str('Nombre y teléfono'),
  }),
];

function systemPrompt(user) {
  const now = new Date();
  const hoy = now.toLocaleString('es-MX', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const iso = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now); // AAAA-MM-DD
  return `Eres Medi 🩺✨, la asistente virtual de MediClick AI dentro de la app móvil. Eres empática, cálida, clara y DIDÁCTICA (explicas con palabras sencillas). Usas emojis con moderación.

Hoy es ${hoy} (centro de México). Fecha ISO de hoy: ${iso}.
Estás hablando con: ${user.name || 'el paciente'} (rol: ${user.role || 'paciente'}).

CÓMO CONVERSAR:
- Si solo saluda o pregunta qué haces: saluda por su nombre y explica en pocas líneas lo que puedes hacer
  (orientar según síntomas, mostrar médicos y horarios, agendar/cancelar/reagendar, guardar su expediente). NO asumas que se siente mal.
- Si cuenta un síntoma: 1 frase empática + "Para orientarte mejor:" y 3 a 5 preguntas NUMERADAS, cortas, con ejemplos entre paréntesis
  (desde cuándo, intensidad 1-10, constante o intermitente, zona, qué lo empeora o alivia, otros síntomas, si tomó algo).
- Cuando ya tengas información, usa "buscar_especialidad" y explica:
  📝 Lo que me contaste · 🩺 Te recomiendo **Especialidad** · 💡 ¿Por qué? · 📋 En la consulta · 🏠 Mientras tanto (sin medicamentos) · ⚠️ Ve a urgencias si...
  y ofrece ver horarios.
- Para horarios usa "ver_disponibilidad". La app muestra los horarios como BOTONES, así que en tu texto NO los enlistes:
  solo di algo como "Estos son los horarios disponibles, toca el que prefieras 👇".
- Para médicos usa "ver_medicos" (la app muestra tarjetas con su foto); en el texto solo un resumen breve.
- Antes de agendar, confirma: especialidad, médico, día y hora. Agenda solo cuando diga que sí. Incluye en "motivo" un resumen de sus síntomas.
- Después de agendar, si no tiene alergias registradas, pregúntale amablemente si tiene alergias o toma medicamentos para guardarlo.
- Para cancelar o reagendar usa primero "mis_citas" para obtener el citaId.

REGLAS:
- NUNCA des diagnósticos, ni recetes medicamentos o dosis. Eres orientación previa, no sustituyes al médico.
- Síntomas graves (dolor de pecho, falta de aire, desmayo, sangrado abundante, accidente, ideas de hacerse daño) → que llame al 911 de inmediato.
- Solo temas de salud, la clínica y citas. Si preguntan otra cosa, redirige con amabilidad.
- Nunca inventes médicos, horarios ni datos: usa las herramientas. Si una devuelve "ok": false, explica el error con palabras simples.
- No muestres IDs (doctorId, citaId).
- Especialidades disponibles: ${SPECIALTIES.join(', ')}.
- Formato: texto corto con saltos de línea; puedes usar **negritas**. Nada de tablas.
- Al final de CADA respuesta agrega una última línea así (2 a 4 opciones cortas que el paciente podría tocar como botón):
SUGERENCIAS: opción 1 | opción 2 | opción 3`;
}

/** Saca la línea "SUGERENCIAS: a | b | c" del texto del modelo */
export function splitSuggestions(text = '') {
  const m = text.match(/\n?[ \t>*_-]*SUGERENCIAS?[*_ \t]*:[*_ \t]*(.+)\s*$/i);
  if (!m) return { reply: text.trim(), suggestions: [] };
  const suggestions = m[1].split('|').map((s) => s.replace(/[*_"]/g, '').trim()).filter((s) => s && s.length <= 40).slice(0, 4);
  return { reply: text.slice(0, m.index).trim(), suggestions };
}

export function makeAssistant({ llm, clinic, knowledge, sessions, events, fallback }) {
  return async function assistantChat({ user, message, history = [] }) {
    if (!message || !message.trim()) throw new DomainError('Escríbele algo a Medi', 400);
    const userId = user.id;

    // 1) Seguridad primero: síntomas de alarma → 911 (sin IA)
    const em = detectEmergency(message);
    if (em) {
      await sessions.save({ userId, channel: 'app', message, reply: em.reply, specialty: null, emergency: true });
      await events.publish('triaje.emergencia_detectada', { userId, channel: 'app', flags: em.flags, type: em.type, message });
      return { emergency: true, emergencyType: em.type, flags: em.flags, reply: em.reply, suggestions: [], cards: [], mode: 'reglas' };
    }

    // 2) Sin LLM con herramientas → triaje clásico (RAG)
    if (!llm.available || !llm.chatWithTools) {
      return { ...(await fallback({ userId, channel: 'app', message, history })), cards: [] };
    }

    const cards = new Map(); // una tarjeta por tipo (la más reciente)
    let specialty = null;

    // 3) Ejecutor de herramientas (llama a los microservicios por la red interna)
    async function run(name, a = {}) {
      switch (name) {
        case 'buscar_especialidad': {
          const docs = await knowledge.search(String(a.sintomas || message), 3);
          if (docs[0]?.score > 0.12) specialty = docs[0].specialty;
          return { opciones: docs.map((d) => ({ especialidad: d.specialty, tema: d.title, atiende: d.content.slice(0, 220), similitud: +d.score.toFixed(2) })) };
        }
        case 'ver_medicos': {
          const r = await clinic.doctors(a.especialidad);
          if (r.ok !== false) cards.set('doctors', { type: 'doctors', medicos: r.medicos });
          return r;
        }
        case 'ver_disponibilidad': {
          const r = await clinic.availability(a.especialidad, a.fecha);
          if (r.ok !== false) {
            specialty = r.especialidad;
            cards.set('slots', { type: 'slots', especialidad: r.especialidad, dias: r.dias });
          }
          return r;
        }
        case 'agendar_cita': {
          const r = await clinic.book({ patientId: userId, patientName: user.name, doctorId: a.medico, date: a.fecha, time: a.hora, reason: a.motivo, channel: 'app' });
          if (r.ok) { cards.delete('slots'); cards.set('appointment', { type: 'appointment', titulo: '✅ Cita agendada', cita: r.cita }); }
          return r;
        }
        case 'mis_citas': {
          const r = await clinic.myAppointments(userId);
          if (r.ok !== false) cards.set('appointments', { type: 'appointments', citas: r.citas });
          return r;
        }
        case 'cancelar_cita': {
          const r = await clinic.cancel(userId, a.citaId);
          if (r.ok) { cards.delete('appointments'); cards.set('appointment', { type: 'appointment', titulo: '❌ Cita cancelada', cita: r.cita }); }
          return r;
        }
        case 'reagendar_cita': {
          const r = await clinic.reschedule(userId, a.citaId, a.fecha, a.hora);
          if (r.ok) { cards.delete('slots'); cards.set('appointment', { type: 'appointment', titulo: '🔄 Cita reagendada', cita: r.cita }); }
          return r;
        }
        case 'ver_expediente': {
          const r = await clinic.record(userId);
          if (r.ok) cards.set('record', { type: 'record', expediente: r });
          return r;
        }
        case 'actualizar_expediente': {
          const r = await clinic.updateRecord(userId, a);
          if (r.ok) cards.set('record', { type: 'record', titulo: '💾 Expediente actualizado', expediente: await clinic.record(userId) });
          return r;
        }
        default:
          return { ok: false, error: `Herramienta desconocida: ${name}` };
      }
    }

    // 4) Ciclo del agente
    const messages = [
      { role: 'system', content: systemPrompt(user) },
      ...history.slice(-12).map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content || '').slice(0, 2500) })),
      { role: 'user', content: message },
    ];
    const used = [];
    let text = null;
    try {
      for (let step = 0; step < MAX_STEPS && text === null; step++) {
        const m = await llm.chatWithTools({ messages, tools: TOOLS });
        if (m.tool_calls?.length) {
          messages.push({ role: 'assistant', content: m.content || '', tool_calls: m.tool_calls });
          for (const tc of m.tool_calls) {
            let args = {};
            try { args = JSON.parse(tc.function?.arguments || '{}'); } catch { /* argumentos vacíos */ }
            const result = await run(tc.function?.name, args).catch((e) => ({ ok: false, error: e.message }));
            used.push(tc.function?.name);
            messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result).slice(0, 6000) });
          }
        } else {
          text = m.content || '';
        }
      }
    } catch (e) {
      console.warn(`[medi] el agente falló (${e.message}); uso triaje clásico`);
      return { ...(await fallback({ userId, channel: 'app', message, history })), cards: [] };
    }

    const { reply: raw, suggestions } = splitSuggestions(text || 'Perdón, me confundí un poquito 😅 ¿Me lo repites con otras palabras?');
    const showDisclaimer = used.includes('buscar_especialidad');
    const reply = showDisclaimer ? `${raw}\n\n${DISCLAIMER}` : raw;

    await sessions.save({ userId, channel: 'app', message, reply, specialty, emergency: false });
    await events.publish('triaje.completado', { userId, channel: 'app', specialty, mode: 'agente', tools: used });

    return {
      emergency: false,
      reply,
      suggestions,
      cards: [...cards.values()],
      specialty: used.includes('buscar_especialidad') ? specialty : null,
      tools: used,
      mode: 'llm',
    };
  };
}
