// Adaptador de salida: habla con appointment-service y patient-service
// por la red interna de Docker (rutas /internal que el Gateway NO expone).
const enc = encodeURIComponent;

export function createClinicClient({ appointmentUrl, patientUrl }) {
  async function call(method, url, body) {
    try {
      const r = await fetch(url, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: `Servicio no disponible (${e.message})` };
    }
  }

  return {
    doctors: (specialty) => call('GET', `${appointmentUrl}/internal/doctors?specialty=${enc(specialty || '')}`),
    availability: (specialty, date) =>
      call('GET', `${appointmentUrl}/internal/availability?specialty=${enc(specialty || '')}&date=${enc(date || '')}`),
    book: (b) => call('POST', `${appointmentUrl}/internal/appointments`, b),
    myAppointments: (patientId) => call('GET', `${appointmentUrl}/internal/patients/${enc(patientId)}/appointments`),
    cancel: (patientId, id) => call('POST', `${appointmentUrl}/internal/appointments/${enc(id || 'x')}/cancel`, { patientId }),
    reschedule: (patientId, id, date, time) =>
      call('POST', `${appointmentUrl}/internal/appointments/${enc(id || 'x')}/reschedule`, { patientId, date, time }),
    record: (patientId) => call('GET', `${patientUrl}/internal/patients/${enc(patientId)}/record`),
    updateRecord: (patientId, data) => call('POST', `${patientUrl}/internal/patients/${enc(patientId)}/record`, data),
  };
}
