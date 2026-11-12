// ===== COMPOSITION ROOT =====
import { connectRabbit } from './infrastructure/messaging/rabbit.js';
import { createPgAdapters, createClaudeLLM, createOpenAICompatLLM } from './infrastructure/adapters.js';
import { createServer } from './infrastructure/http/server.js';
import { makeTriage, makeEmergencyCheck } from './application/usecases.js';
import { makeAssistant } from './application/assistant.js';
import { createClinicClient } from './infrastructure/clinicClient.js';

const {
  PORT = 3004, DATABASE_URL, RABBITMQ_URL,
  GROQ_API_KEY, GROQ_MODEL = 'openai/gpt-oss-120b',
  XAI_API_KEY, XAI_MODEL = 'grok-3-mini',
  ANTHROPIC_API_KEY, LLM_MODEL = 'claude-haiku-5-5',
  APPOINTMENT_SERVICE_URL = 'http://appointment-service:3002',
  PATIENT_SERVICE_URL = 'http://patient-service:3001',
} = process.env;

// Elige el LLM según la API key que pongas en .env (prioridad: Groq > xAI > Claude > modo local)
function pickLLM() {
  if (GROQ_API_KEY) return { llm: createOpenAICompatLLM('https://api.groq.com/openai/v1', GROQ_API_KEY.trim(), GROQ_MODEL), name: `Groq ${GROQ_MODEL}` };
  if (XAI_API_KEY) return { llm: createOpenAICompatLLM('https://api.x.ai/v1', XAI_API_KEY.trim(), XAI_MODEL), name: `xAI ${XAI_MODEL}` };
  if (ANTHROPIC_API_KEY) return { llm: createClaudeLLM(ANTHROPIC_API_KEY.trim(), LLM_MODEL), name: `Claude ${LLM_MODEL}` };
  return { llm: { available: false }, name: null };
}

const events = await connectRabbit(RABBITMQ_URL, {
  serviceName: 'triage-service',
  setup: async (ch) => {
    await ch.assertQueue('auditoria.triaje', { durable: true });
    await ch.bindQueue('auditoria.triaje', 'mediclick.events', 'triaje.#');
  },
});
const { knowledge, sessions } = await createPgAdapters(DATABASE_URL);
const { llm, name } = pickLLM();
console.log(llm.available ? `[llm] usando ${name}` : '[llm] sin API key -> modo local (solo RAG)');

const triageChat = makeTriage({ knowledge, llm, sessions, events });
const clinic = createClinicClient({ appointmentUrl: APPOINTMENT_SERVICE_URL, patientUrl: PATIENT_SERVICE_URL });
const assistantChat = makeAssistant({ llm, clinic, knowledge, sessions, events, fallback: triageChat });
console.log(llm.chatWithTools ? '[medi] agente con herramientas activo' : '[medi] sin herramientas (necesita Groq o xAI) -> triaje clásico');

createServer(triageChat, makeEmergencyCheck({ sessions, events }), sessions, assistantChat)
  .listen(PORT, () => console.log(`triage-service escuchando en :${PORT}`));
