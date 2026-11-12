import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Linking, RefreshControl, StyleSheet } from 'react-native';
import { api } from '../api';
import { API_URL } from '../config';
import { colors, shadow, fmtDate } from '../theme';
import { Card, Muted, Hero, Avatar, SectionTitle, Button, Input } from '../components/ui';

/** Resumen para administradores. La gestión completa está en el panel web. */
export default function AdminScreen({ session, onAuthError }) {
  const [data, setData] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, a, t, em] = await Promise.all([api.adminUserStats(), api.adminApptStats(), api.adminTriageStats(), api.adminEmergencies()]);
      setData({ u, a, t, em });
    } catch (e) { onAuthError(e); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setTimeout(() => api.adminUsers(q).then((l) => setUsers(l.slice(0, 8))).catch(onAuthError), 300);
    return () => clearTimeout(t);
  }, [q]);

  const stat = (icon, n, label, bg) => (
    <View style={[st.stat, { backgroundColor: bg }]} key={label}>
      <View style={st.statDot} />
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={st.statNum}>{n ?? '–'}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );

  const ROLE = { paciente: ['🙂 Paciente', colors.skySoft, colors.sky], medico: ['🩺 Médico', colors.mintSoft, colors.mint], admin: ['⭐ Admin', colors.amberSoft, colors.amber] };

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      <Hero color={colors.purple}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar name={session.user.name} size={56} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={{ color: '#E4DCFF' }}>Panel de administración</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{session.user.name.split(' ')[0]} ⭐</Text>
          </View>
        </View>
        <TouchableOpacity style={st.webBtn} onPress={() => Linking.openURL(`${API_URL}/admin`)}>
          <Text style={{ color: colors.purple, fontWeight: '900' }}>🖥️ Abrir panel completo (editar, eliminar, roles)</Text>
        </TouchableOpacity>
      </Hero>

      <View style={st.grid}>
        {stat('👥', data?.u.paciente, 'Pacientes', colors.skySoft)}
        {stat('🩺', data?.a.medicos.activos, 'Médicos', colors.mintSoft)}
        {stat('📅', data?.a.citas.proximas, 'Citas próximas', colors.purpleSoft)}
        {stat('✈️', data?.a.citas.telegram, 'Por Telegram', colors.accentSoft)}
        {stat('🤖', data?.t.total, 'Chats con Medi', colors.roseSoft)}
        {stat('🚨', data?.t.emergencias, 'Emergencias', colors.dangerSoft)}
      </View>

      {data?.em?.length > 0 && (
        <>
          <SectionTitle>🚨 Últimas emergencias</SectionTitle>
          {data.em.map((s) => (
            <Card key={s.id} style={{ borderLeftWidth: 5, borderLeftColor: colors.danger }}>
              <Text style={{ fontWeight: '800', color: colors.text }}>"{s.message}"</Text>
              <Muted style={{ fontSize: 12 }}>{fmtDate(s.createdAt)} · {s.channel === 'telegram' ? '✈️ Telegram' : '📱 App'}</Muted>
            </Card>
          ))}
        </>
      )}

      <SectionTitle>👥 Usuarios</SectionTitle>
      <Input icon="🔎" placeholder="Buscar usuario" value={q} onChangeText={setQ} />
      {users.map((u) => {
        const [label, bg, fg] = ROLE[u.role] || ROLE.paciente;
        return (
          <Card key={u.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
            <Avatar name={u.name} size={44} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontWeight: '900', color: colors.text }}>{u.name}</Text>
              <Muted style={{ fontSize: 12 }}>{u.isTelegramOnly ? '✈️ Registrado por Telegram' : u.email}</Muted>
              {u.allergies ? <Text style={{ fontSize: 12, color: colors.danger, marginTop: 2 }}>🌾 {u.allergies}</Text> : null}
            </View>
            <Text style={[st.pill, { backgroundColor: bg, color: fg }]}>{label}</Text>
          </Card>
        );
      })}
      <Button title="Gestionar todo en el panel web" icon="🖥️" variant="soft" onPress={() => Linking.openURL(`${API_URL}/admin`)} style={{ marginTop: 6 }} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  webBtn: { backgroundColor: '#fff', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, marginTop: 16, alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  stat: { width: '31.5%', borderRadius: 20, padding: 12, marginBottom: 10, overflow: 'hidden', ...shadow },
  statDot: { position: 'absolute', width: 50, height: 50, borderRadius: 25, right: -14, top: -14, backgroundColor: 'rgba(255,255,255,0.55)' },
  statNum: { fontSize: 24, fontWeight: '900', color: colors.text, marginTop: 4 },
  statLabel: { fontSize: 11, fontWeight: '800', color: colors.muted },
  pill: { fontSize: 11, fontWeight: '800', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden' },
});
