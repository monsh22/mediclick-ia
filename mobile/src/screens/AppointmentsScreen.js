import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, Alert, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { api } from '../api';
import { colors, fmtDate, fmtTime, specialtyStyle } from '../theme';
import { Card, Muted, Button, Hero, DateBadge, StatusPill, SectionTitle } from '../components/ui';

export default function AppointmentsScreen({ session, navigate, onAuthError }) {
  const isDoctor = session.user.role === 'medico';
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('upcoming');

  const load = useCallback(async () => {
    try { setItems(await api.myAppointments()); } catch (e) { onAuthError(e); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = (a) => {
    Alert.alert('Cancelar cita', `¿Seguro que quieres cancelar la cita del ${fmtDate(a.startsAt)}?`, [
      { text: 'No' },
      {
        text: 'Sí, cancelar', style: 'destructive',
        onPress: async () => {
          try { await api.cancel(a.id); load(); } catch (e) { Alert.alert('Error', e.message); }
        },
      },
    ]);
  };

  const upcoming = items
    .filter((a) => a.status === 'programada' && new Date(a.startsAt) > new Date())
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const past = items.filter((a) => !upcoming.includes(a));
  const list = tab === 'upcoming' ? upcoming : past;

  const renderCard = (a) => {
    const sp = specialtyStyle(a.specialty);
    const active = tab === 'upcoming';
    return (
      <Card key={a.id} style={{ borderLeftWidth: 6, borderLeftColor: active ? sp.color : colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <DateBadge iso={a.startsAt} color={active ? sp.color : '#A9B6C3'} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ fontWeight: '900', fontSize: 16, color: colors.text }}>
              {isDoctor ? `👤 ${a.patientName}` : `${sp.icon} ${a.specialty}`}
            </Text>
            <Muted style={{ fontSize: 13 }}>{isDoctor ? `📝 ${a.reason}` : a.doctorName}</Muted>
            <Text style={{ color: active ? sp.color : colors.muted, fontWeight: '800', marginTop: 3 }}>🕐 {fmtTime(a.startsAt)} · {a.office}</Text>
          </View>
          <StatusPill status={a.status} />
        </View>
        {active && (
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            {!isDoctor && (
              <Button
                title="Reagendar"
                icon="🔄"
                variant="outline"
                style={{ flex: 1, marginRight: 8, paddingVertical: 10, borderColor: sp.color }}
                onPress={() => navigate('book', { reschedule: { id: a.id, doctorId: a.doctorId, specialty: a.specialty, startsAt: a.startsAt } })}
              />
            )}
            <Button title="Cancelar" icon="✕" variant="danger" style={{ flex: 1, paddingVertical: 10 }} onPress={() => cancel(a)} />
          </View>
        )}
      </Card>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: 18 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Hero color={isDoctor ? colors.sky : colors.primary}>
        <Text style={{ fontSize: 32 }}>{isDoctor ? '🗓️' : '🗂️'}</Text>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 6 }}>{isDoctor ? 'Mi agenda' : 'Mis citas'}</Text>
        <View style={{ flexDirection: 'row', marginTop: 14 }}>
          <View style={st.stat}><Text style={st.statNum}>{upcoming.length}</Text><Text style={st.statLabel}>Próximas</Text></View>
          <View style={st.stat}><Text style={st.statNum}>{items.filter((a) => a.status === 'cancelada').length}</Text><Text style={st.statLabel}>Canceladas</Text></View>
          <View style={st.stat}><Text style={st.statNum}>{items.length}</Text><Text style={st.statLabel}>Total</Text></View>
        </View>
      </Hero>

      <View style={st.segment}>
        {[['upcoming', `Próximas (${upcoming.length})`], ['past', `Historial (${past.length})`]].map(([k, label]) => (
          <TouchableOpacity key={k} style={[st.segBtn, tab === k && st.segActive]} onPress={() => setTab(k)}>
            <Text style={[st.segText, tab === k && { color: colors.primary }]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {list.length ? list.map(renderCard) : (
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Text style={{ fontSize: 38 }}>{tab === 'upcoming' ? '📭' : '🕰️'}</Text>
          <Muted style={{ marginTop: 6 }}>
            {tab === 'upcoming' ? (isDoctor ? 'No tienes pacientes agendados.' : 'No tienes citas próximas.') : 'Aún no hay historial.'}
          </Muted>
          {tab === 'upcoming' && !isDoctor && (
            <Button title="Agendar cita" icon="+" onPress={() => navigate('book')} style={{ marginTop: 12, paddingVertical: 10, paddingHorizontal: 24 }} />
          )}
        </Card>
      )}
      <SectionTitle><Text style={{ fontSize: 12, color: colors.muted, fontWeight: '600' }}>Desliza hacia abajo para actualizar</Text></SectionTitle>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 16, paddingVertical: 10, marginRight: 8, alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700' },
  segment: { flexDirection: 'row', backgroundColor: '#E6EDF3', borderRadius: 16, padding: 4, marginBottom: 14 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  segActive: { backgroundColor: '#fff' },
  segText: { fontWeight: '800', color: colors.muted },
});
