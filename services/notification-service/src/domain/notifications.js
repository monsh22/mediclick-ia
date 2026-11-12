// ===== DOMINIO: qué notificar y cuándo =====

const fmt = (iso) =>
  new Date(iso).toLocaleString('es-MX', {
    timeZone: 'America/Mexico_City', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
  });

/** Recordatorios antes de la cita para reducir ausentismo (24h y 2h) */
export function planReminders(startsAt, now = Date.now(), demo = false) {
  const start = new Date(startsAt).getTime();
  const plan = demo
    ? [{ kind: '24h', at: now + 30_000 }, { kind: '2h', at: now + 60_000 }]
    : [{ kind: '24h', at: start - 24 * 3600_000 }, { kind: '2h', at: start - 2 * 3600_000 }];
  return plan.filter((r) => r.at > now).map((r) => ({ ...r, delay: r.at - now }));
}

/** Convierte un evento de dominio en el mensaje para el paciente */
export function buildMessage(event, d, extra = {}) {
  const when = d.startsAt ? fmt(d.startsAt) : '';
  switch (event) {
    case 'cita.creada':
      return { title: '✅ Cita confirmada', body: `${d.specialty} con ${d.doctorName}, ${when}. ${d.office || ''}`.trim() };
    case 'cita.cancelada':
      return { title: '❌ Cita cancelada', body: `Tu cita de ${d.specialty} del ${when} fue cancelada.` };
    case 'cita.reagendada':
      return { title: '🔄 Cita reagendada', body: `Tu cita de ${d.specialty} ahora es el ${when}.` };
    case 'recordatorio':
      return {
        title: extra.kind === '2h' ? '⏰ Tu cita es en 2 horas' : '📅 Tu cita es mañana',
        body: `${d.specialty} con ${d.doctorName}, ${when}. ${d.office || ''} Si no puedes asistir, cancela o reagenda desde la app.`.trim(),
      };
    case 'usuario.sesion_iniciada':
      return { title: '🔐 Inicio de sesión', body: `Se inició sesión en tu cuenta (${new Date(d.at).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}).` };
    case 'triaje.emergencia_detectada':
      return { title: '🚨 Posible emergencia', body: 'Detectamos síntomas de alarma. Si sigues en riesgo, llama al 911 de inmediato.' };
    default:
      return null;
  }
}
