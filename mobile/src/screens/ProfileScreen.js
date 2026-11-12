import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Alert, StyleSheet } from 'react-native';
import { api } from '../api';
import { colors, shadow } from '../theme';
import { Card, Muted, Input, Button, ErrorText, Hero, Avatar, Diamond } from '../components/ui';

const PERSONAL = [
  ['name', 'Nombre completo', '👤'],
  ['phone', 'Teléfono', '📱'],
  ['birthDate', 'Fecha de nacimiento (AAAA-MM-DD)', '🎂'],
  ['emergencyContact', 'Contacto de emergencia (nombre y teléfono)', '🆘'],
];
const MEDICAL = [
  ['bloodType', 'Tipo de sangre (ej. O+)', '🩸'],
  ['allergies', 'Alergias', '🌾'],
  ['chronicConditions', 'Enfermedades crónicas', '🫀'],
  ['currentMedications', 'Medicamentos que tomas actualmente', '💊'],
];
const ALL = [...PERSONAL, ...MEDICAL, ['telegramChatId', 'ID de chat de Telegram', '✈️']];
const ROLE = { paciente: ['🙂 Paciente', colors.amber], medico: ['🩺 Médico', colors.sky], admin: ['⭐ Administrador', colors.purple] };

export default function ProfileScreen({ session, onLogout, setSession, onAuthError }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.me().then((u) => setForm(Object.fromEntries(ALL.map(([k]) => [k, u[k] ?? ''])))).catch(onAuthError);
  }, []);

  const save = async () => {
    setError('');
    setSaving(true);
    try {
      const user = await api.updateMe(form);
      setSession({ ...session, user: { ...session.user, name: user.name } });
      Alert.alert('Guardado ✅', 'Tu expediente se actualizó.');
    } catch (e) {
      onAuthError(e);
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const field = ([k, label, icon]) => (
    <Input key={k} icon={icon} label={label} value={String(form[k] ?? '')} onChangeText={(v) => setForm({ ...form, [k]: v })} autoCapitalize={k === 'name' ? 'words' : 'none'} />
  );

  // Qué tan completo está el expediente
  const filled = MEDICAL.concat(PERSONAL).filter(([k]) => String(form[k] ?? '').trim()).length;
  const total = MEDICAL.length + PERSONAL.length;
  const [roleLabel, roleColor] = ROLE[session.user.role] || ROLE.paciente;

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <Hero color={colors.primaryDark} style={{ alignItems: 'center' }}>
        <View style={st.avatarRing}><Avatar name={session.user.name} size={90} color={colors.accent} border={false} /></View>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 10 }}>{session.user.name}</Text>
        <Text style={{ color: '#CDEFEA' }}>{session.user.email}</Text>
        <View style={{ backgroundColor: roleColor, paddingVertical: 5, paddingHorizontal: 14, borderRadius: 999, marginTop: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>{roleLabel}</Text>
        </View>
      </Hero>

      {/* Barra de progreso del expediente */}
      <Card style={{ backgroundColor: colors.mintSoft }}>
        <Text style={{ fontWeight: '900', color: colors.mint }}>📋 Tu expediente está {Math.round((filled / total) * 100)}% completo</Text>
        <View style={st.track}><View style={[st.fill, { width: `${(filled / total) * 100}%` }]} /></View>
        <Muted style={{ fontSize: 12, marginTop: 6 }}>
          Entre más completo, mejor te atiende tu médico. También puedes pedirle a Medi en Telegram que lo llene por ti.
        </Muted>
      </Card>

      <Card>
        <Diamond size={30} color={colors.skySoft} top={14} right={16} />
        <Text style={st.h}>👤 Datos personales</Text>
        {PERSONAL.map(field)}
      </Card>

      <Card>
        <Diamond size={30} color={colors.roseSoft} top={14} right={16} />
        <Text style={[st.h, { color: colors.danger }]}>❤️ Expediente médico</Text>
        {MEDICAL.map(field)}
      </Card>

      <Card style={{ backgroundColor: colors.skySoft }}>
        <Text style={[st.h, { color: colors.sky, marginBottom: 6 }]}>✈️ Recordatorios por Telegram</Text>
        <Muted style={{ fontSize: 13, marginBottom: 12 }}>
          Escríbele al bot de MediClick, pídele tu ID de chat y pégalo aquí para unir tu cuenta de la app con Telegram.
        </Muted>
        {field(['telegramChatId', 'ID de chat', '#️⃣'])}
      </Card>

      <ErrorText>{error}</ErrorText>
      <Button title="Guardar cambios" icon="💾" onPress={save} loading={saving} />
      <Button title="Cerrar sesión" variant="ghost" onPress={onLogout} style={{ marginTop: 8 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  avatarRing: { borderRadius: 50, padding: 4, backgroundColor: 'rgba(255,255,255,0.3)', ...shadow },
  h: { fontWeight: '900', color: colors.primary, marginBottom: 12, fontSize: 16 },
  track: { height: 10, backgroundColor: '#fff', borderRadius: 99, marginTop: 10, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.mint, borderRadius: 99 },
});
