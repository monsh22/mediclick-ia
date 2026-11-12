import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Linking, Image } from 'react-native';
import { colors, radius, shadow, pastel, avatarUrl } from '../theme';

export function Button({ title, onPress, variant = 'primary', loading, disabled, style, icon }) {
  const v = variants[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      style={[s.btn, { backgroundColor: v.bg, borderColor: v.border }, variant === 'primary' && shadow, (disabled || loading) && { opacity: 0.55 }, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <Text style={[s.btnText, { color: v.fg }]}>{icon ? `${icon}  ` : ''}{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const variants = {
  primary: { bg: colors.primary, fg: '#fff', border: colors.primary },
  accent: { bg: colors.accent, fg: '#fff', border: colors.accent },
  outline: { bg: '#fff', fg: colors.primary, border: colors.primary },
  soft: { bg: colors.purpleSoft, fg: colors.purple, border: colors.purpleSoft },
  danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  ghost: { bg: 'transparent', fg: colors.muted, border: 'transparent' },
};

export function Input({ label, icon, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <View style={s.inputWrap}>
        {icon ? <Text style={s.inputIcon}>{icon}</Text> : null}
        <TextInput placeholderTextColor="#A3AEC0" style={s.input} {...props} />
      </View>
    </View>
  );
}

export const Card = ({ children, style }) => <View style={[s.card, style]}>{children}</View>;

export const Title = ({ children, style }) => <Text style={[s.title, style]}>{children}</Text>;

export const Muted = ({ children, style }) => <Text style={[s.muted, style]}>{children}</Text>;

export const SectionTitle = ({ children, right }) => (
  <View style={s.sectionRow}>
    <Text style={s.section}>{children}</Text>
    {right}
  </View>
);

export function Chip({ label, active, onPress, color = colors.primary, icon }) {
  return (
    <TouchableOpacity onPress={onPress} style={[s.chip, active && { backgroundColor: color, borderColor: color }]}>
      <Text style={[s.chipText, active && { color: '#fff' }]}>{icon ? `${icon} ` : ''}{label}</Text>
    </TouchableOpacity>
  );
}

export const ErrorText = ({ children }) => (children ? <Text style={s.error}>⚠️ {children}</Text> : null);

/** Círculo decorativo para fondos */
export const Blob = ({ size, color, top, left, right, bottom, opacity = 1 }) => (
  <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, top, left, right, bottom, opacity }} />
);

/** Cuadro redondeado girado (forma decorativa) */
export const Diamond = ({ size, color, top, left, right, bottom, rotate = '18deg', opacity = 1 }) => (
  <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size * 0.3, backgroundColor: color, top, left, right, bottom, opacity, transform: [{ rotate }] }} />
);

/** Anillo decorativo */
export const Ring = ({ size, color, top, left, right, bottom, width = 6, opacity = 1 }) => (
  <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: width, borderColor: color, top, left, right, bottom, opacity }} />
);

/** Fondo pastel de toda la app, con formas suaves */
export function PastelBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Blob size={260} color={pastel[0]} top={-90} right={-90} />
      <Blob size={180} color={pastel[1]} top={260} left={-90} />
      <Diamond size={70} color={pastel[3]} top={180} right={-18} rotate="24deg" />
      <Ring size={120} color={pastel[4]} bottom={160} right={-40} width={14} />
      <Blob size={220} color={pastel[2]} bottom={-110} left={-50} opacity={0.8} />
      <Diamond size={36} color={pastel[5]} bottom={300} left={30} rotate="-14deg" />
    </View>
  );
}

/** Encabezado de color con figuras decorativas */
export function Hero({ children, color = colors.primary, style }) {
  return (
    <View style={[s.hero, { backgroundColor: color }, style]}>
      <Blob size={190} color="#FFFFFF" opacity={0.09} top={-70} right={-50} />
      <Ring size={120} color="#FFFFFF" opacity={0.12} bottom={-50} left={-30} width={16} />
      <Blob size={44} color={colors.accent} opacity={0.9} top={20} right={74} />
      <Diamond size={22} color={colors.amber} top={64} right={30} rotate="20deg" />
      <Blob size={12} color="#FFFFFF" opacity={0.7} bottom={26} right={120} />
      {children}
    </View>
  );
}

/** Ícono dentro de un cuadro redondeado de color */
export const IconBadge = ({ icon, color = colors.primarySoft, size = 46 }) => (
  <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontSize: size * 0.48 }}>{icon}</Text>
  </View>
);

/**
 * Avatar ilustrado (DiceBear). Si no hay internet, muestra las iniciales.
 * uri: imagen específica (ej. la de Medi). name: semilla del avatar.
 */
export function Avatar({ name = '', size = 48, color = colors.accent, uri, square, border = true }) {
  const [failed, setFailed] = useState(false);
  const r = square ? size * 0.32 : size / 2;
  const initials = name.replace(/^(Dra?\.|Psic\.)\s*/, '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const frame = { width: size, height: size, borderRadius: r, overflow: 'hidden', borderWidth: border ? 3 : 0, borderColor: 'rgba(255,255,255,0.75)' };
  if (failed) {
    return (
      <View style={[frame, { backgroundColor: color, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: '#fff', fontWeight: '900', fontSize: size * 0.36 }}>{initials || '🙂'}</Text>
      </View>
    );
  }
  return (
    <View style={[frame, { backgroundColor: '#fff' }]}>
      <Image source={{ uri: uri || avatarUrl(name) }} style={{ width: '100%', height: '100%' }} onError={() => setFailed(true)} />
    </View>
  );
}

/** Fila de avatares encimados (ej. "nuestros médicos") */
export function AvatarStack({ names = [], size = 34, max = 5 }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {names.slice(0, max).map((n, i) => (
        <View key={n} style={{ marginLeft: i ? -size * 0.3 : 0 }}><Avatar name={n} size={size} color={colors.purple} /></View>
      ))}
    </View>
  );
}

/** Bloque de fecha estilo calendario */
export function DateBadge({ iso, color = colors.primary }) {
  const d = new Date(iso);
  return (
    <View style={[s.dateBadge, { backgroundColor: color }]}>
      <Text style={s.dateMonth}>{d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '').toUpperCase()}</Text>
      <Text style={s.dateDay}>{d.getDate()}</Text>
    </View>
  );
}

/** Etiqueta de estado */
export function StatusPill({ status }) {
  const map = {
    programada: [colors.primarySoft, colors.primary],
    cancelada: [colors.dangerSoft, colors.danger],
    completada: [colors.successSoft, colors.success],
  };
  const [bg, fg] = map[status] || [colors.border, colors.muted];
  return <Text style={[s.pill, { backgroundColor: bg, color: fg }]}>{status}</Text>;
}

/** Botón de emergencia: abre el marcador del teléfono con el 911 */
export function EmergencyBanner({ compact }) {
  return (
    <TouchableOpacity onPress={() => Linking.openURL('tel:911')} style={[s.sos, compact && { paddingVertical: 10 }]} activeOpacity={0.85}>
      <View style={s.sosIconWrap}><Text style={{ fontSize: compact ? 16 : 20 }}>🚨</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.sosTitle}>¿Es una emergencia?</Text>
        {!compact && <Text style={s.sosText}>Dolor de pecho, falta de aire, desmayo, sangrado abundante o accidente.</Text>}
      </View>
      <View style={s.sosCall}><Text style={{ color: '#fff', fontWeight: '900' }}>📞 911</Text></View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { paddingVertical: 15, paddingHorizontal: 18, borderRadius: 16, alignItems: 'center', borderWidth: 1.5 },
  btnText: { fontSize: 16, fontWeight: '800' },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: '700' },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FAF9FF', borderWidth: 1.5, borderColor: colors.border, borderRadius: 16 },
  inputIcon: { fontSize: 16, paddingLeft: 14 },
  input: { flex: 1, padding: 14, fontSize: 16, color: colors.text },
  card: { backgroundColor: colors.card, borderRadius: radius, padding: 16, marginBottom: 12, ...shadow },
  title: { fontSize: 24, fontWeight: '900', color: colors.text, marginBottom: 4 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 10 },
  section: { fontSize: 17, fontWeight: '900', color: colors.text },
  chip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff', marginRight: 8, marginBottom: 8 },
  chipText: { color: colors.text, fontWeight: '700' },
  error: { color: colors.danger, marginVertical: 8, fontWeight: '700' },
  hero: { borderRadius: 30, padding: 22, overflow: 'hidden', marginBottom: 16 },
  dateBadge: { width: 58, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dateMonth: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  dateDay: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: -2 },
  pill: { fontSize: 12, fontWeight: '800', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, overflow: 'hidden', textTransform: 'capitalize' },
  sos: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: radius, padding: 12, marginBottom: 12, borderLeftWidth: 5, borderLeftColor: colors.danger, ...shadow },
  sosIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.dangerSoft, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  sosTitle: { color: colors.danger, fontWeight: '900', fontSize: 15 },
  sosText: { color: '#7F1D1D', fontSize: 12, marginTop: 2 },
  sosCall: { backgroundColor: colors.danger, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12 },
});
