import { API_URL } from './config';

let token = null;
export const setToken = (t) => { token = t; };

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(`No se pudo conectar con el servidor (${API_URL}). Revisa la IP y que tu celular esté en la misma red WiFi.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || data.message || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  register: (data) => request('POST', '/auth/register', data),
  me: () => request('GET', '/patients/me'),
  updateMe: (data) => request('PUT', '/patients/me', data),

  specialties: () => request('GET', '/doctors/specialties'),
  doctors: (specialty) => request('GET', `/doctors${specialty ? `?specialty=${encodeURIComponent(specialty)}` : ''}`),
  slots: (doctorId, date) => request('GET', `/doctors/${doctorId}/slots?date=${date}`),

  book: (data) => request('POST', '/appointments', data),
  myAppointments: () => request('GET', '/appointments/me'),
  cancel: (id) => request('PATCH', `/appointments/${id}/cancel`),
  reschedule: (id, startsAt) => request('PATCH', `/appointments/${id}/reschedule`, { startsAt }),

  notifications: () => request('GET', '/notifications/me'),
  readNotifications: () => request('POST', '/notifications/me/read'),

  triage: (message, history) => request('POST', '/triage/chat', { message, history }),
  // Medi: agente con herramientas (ve médicos, horarios, agenda, expediente…)
  assistant: (message, history) => request('POST', '/triage/assistant', { message, history }),

  // Solo administradores
  adminUserStats: () => request('GET', '/admin/users/stats'),
  adminApptStats: () => request('GET', '/admin/appointments/stats'),
  adminTriageStats: () => request('GET', '/admin/triage/stats'),
  adminEmergencies: () => request('GET', '/admin/triage/sessions?emergency=true&limit=5'),
  adminUsers: (q = '') => request('GET', `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ''}`),
};
