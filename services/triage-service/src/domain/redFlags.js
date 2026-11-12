// ===== DOMINIO: detección de síntomas de alarma =====
// Se evalúa ANTES de llamar a la IA. Si hay una señal de alarma, no se agenda:
// se indica llamar al 911 de inmediato.

export const normalize = (t = '') =>
  t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');

const RULES = [
  { id: 'dolor_pecho', label: 'Dolor u opresión en el pecho', re: /(dolor|duele|opresion|presion|aprieta|punzada).{0,20}pecho|pecho.{0,20}(dolor|duele|opresion|aprieta)|infarto/ },
  { id: 'respiracion', label: 'Dificultad grave para respirar', re: /no puedo respirar|dificultad (grave |severa )?(para|al) respirar|me ahogo|me falta (mucho )?el aire|labios morados/ },
  { id: 'evc', label: 'Posible derrame cerebral (EVC)', re: /cara (caida|chueca|torcida)|no puedo mover (un|el|la|mi) (lado|brazo|pierna)|hablo raro|habla arrastrada|no puedo hablar|perdi la vista de repente/ },
  { id: 'conciencia', label: 'Pérdida de conciencia o convulsiones', re: /desmay|perdi el conocimiento|inconsciente|convulsi|no reacciona|no despierta/ },
  { id: 'sangrado', label: 'Sangrado abundante', re: /sangrado (abundante|que no para|mucho)|hemorragia|vomito (con )?sangre|no para de sangrar/ },
  { id: 'trauma', label: 'Accidente o golpe fuerte', re: /accidente|atropell|golpe (muy )?fuerte en la cabeza|fractura expuesta|herida (profunda|de bala|con cuchillo)|apunal/ },
  { id: 'intoxicacion', label: 'Intoxicación o envenenamiento', re: /envenen|intoxic|sobredosis|me tome (muchas|todas las) pastillas|trague (cloro|veneno|quimico)/ },
  { id: 'alergia', label: 'Reacción alérgica grave', re: /se me (cierra|hincha) la garganta|lengua hinchada|anafilaxia/ },
  { id: 'embarazo', label: 'Emergencia en el embarazo', re: /embarazada.{0,40}(sangr|dolor fuerte|no se mueve)|se me rompio la fuente/ },
  { id: 'bebe_fiebre', label: 'Fiebre en bebé menor de 3 meses', re: /(bebe|recien nacido).{0,40}fiebre|fiebre.{0,40}(bebe|recien nacido)/ },
];

const SELF_HARM = /suicid|quitarme la vida|matarme|no quiero vivir|hacerme dano|lastimarme|ya no quiero estar aqui/;

/**
 * @returns null si no hay alarma, o un objeto con la respuesta de emergencia
 */
export function detectEmergency(text) {
  const t = normalize(text);

  if (SELF_HARM.test(t)) {
    return {
      type: 'salud_mental',
      flags: ['Riesgo para tu vida'],
      reply:
        'Lamento mucho que te sientas así. No estás solo/a y mereces ayuda ahora mismo.\n\n' +
        '📞 Si estás en peligro inmediato, llama al **911**.\n' +
        '💬 Línea de la Vida (México, 24 h, gratuita): **800 911 2000**.\n\n' +
        'Si puedes, busca a alguien de confianza que esté contigo. ¿Quieres contarme cómo te sientes?',
    };
  }

  const flags = RULES.filter((r) => r.re.test(t)).map((r) => r.label);
  if (!flags.length) return null;
  return {
    type: 'fisica',
    flags,
    reply:
      `🚨 Detecté síntomas que pueden ser una EMERGENCIA (${flags.join(', ')}).\n\n` +
      '📞 Llama al **911** ahora o acude a urgencias del hospital más cercano. ' +
      'No esperes una cita.\n\n' +
      'Mientras llega la ayuda: no te quedes solo/a, no manejes y ten a la mano tus medicamentos y alergias.',
  };
}

export const DISCLAIMER =
  'ℹ️ MediClick AI solo orienta sobre qué especialidad consultar; no da diagnósticos. Ante una emergencia llama al 911.';
