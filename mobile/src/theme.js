export const colors = {
  bg: '#F7F5FF',
  card: '#FFFFFF',
  primary: '#0F766E',
  primaryDark: '#0B4F4A',
  primarySoft: '#D5F2EE',
  accent: '#FF8A6B',
  accentSoft: '#FFEDE6',
  purple: '#7C5CFC',
  purpleSoft: '#EEE9FF',
  sky: '#3B9EE8',
  skySoft: '#E6F1FF',
  amber: '#F5A524',
  amberSoft: '#FFF7DB',
  rose: '#EC6A9C',
  roseSoft: '#FFE9F1',
  mint: '#2BB58A',
  mintSoft: '#E2F8EF',
  text: '#1E2A3B',
  muted: '#6B7A90',
  border: '#ECE8F7',
  danger: '#E5383B',
  dangerSoft: '#FDECEC',
  success: '#16A34A',
  successSoft: '#DCFCE7',
};

// Pasteles para fondos y formas decorativas
export const pastel = ['#E8E1FF', '#D9F5EA', '#FFE3D8', '#DDEEFF', '#FFF3C7', '#FFE0EC'];

export const radius = 20;

export const shadow = {
  shadowColor: '#3C288C',
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 5 },
  elevation: 3,
};

// Color e ícono de cada especialidad
export const SPECIALTY = {
  'Medicina General': { icon: '🩺', color: '#0F9F94', soft: '#D8F5F1' },
  'Cardiología': { icon: '❤️', color: '#E5383B', soft: '#FDE4E4' },
  'Pediatría': { icon: '🧸', color: '#F5A524', soft: '#FFF2D9' },
  'Dermatología': { icon: '🧴', color: '#E2558F', soft: '#FDE6F0' },
  'Gastroenterología': { icon: '🍽️', color: '#16A34A', soft: '#DCFCE7' },
  'Ginecología': { icon: '🌸', color: '#D9468F', soft: '#FCE4F1' },
  'Traumatología': { icon: '🦴', color: '#2F6FED', soft: '#E3ECFE' },
  'Neumología': { icon: '🫁', color: '#2D9CDB', soft: '#E0F1FB' },
  'Neurología': { icon: '🧠', color: '#7C5CFC', soft: '#ECE7FF' },
  'Oftalmología': { icon: '👁️', color: '#0891B2', soft: '#DDF4F9' },
  'Otorrinolaringología': { icon: '👂', color: '#EA6A2A', soft: '#FFE9DC' },
  'Psicología': { icon: '💜', color: '#9B51E0', soft: '#F2E6FC' },
};
export const specialtyStyle = (name) => SPECIALTY[name] || { icon: '🏥', color: colors.primary, soft: colors.primarySoft };

// Avatares ilustrados (DiceBear). Necesitan internet; si fallan se muestran iniciales.
const AV_BG = 'e8e1ff,d9f5ea,ffe3d8,ddeeff,fff3c7,ffe0ec';
export const avatarUrl = (seed, style = 'notionists') =>
  `https://api.dicebear.com/9.x/${style}/png?seed=${encodeURIComponent(seed || 'MediClick')}&backgroundColor=${AV_BG}&size=128`;
export const MEDI_AVATAR = 'https://api.dicebear.com/9.x/bottts-neutral/png?seed=Medi&backgroundColor=d5f2ee&size=128';

export const fmtDate = (iso) =>
  new Date(iso).toLocaleString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const fmtTime = (iso) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

export const DAYS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
