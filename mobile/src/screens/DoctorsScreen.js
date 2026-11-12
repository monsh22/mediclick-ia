import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api';
import { colors, shadow, specialtyStyle, DAYS_SHORT } from '../theme';
import { Muted, Hero, Avatar, Chip, Input, AvatarStack } from '../components/ui';

/** Directorio de médicos: quién atiende, dónde y en qué horario */
export default function DoctorsScreen({ session, navigate, onAuthError }) {
  const [doctors, setDoctors] = useState(null);
  const [spec, setSpec] = useState(null);
  const [q, setQ] = useState('');
  const isPatient = session.user.role === 'paciente';

  useEffect(() => { api.doctors().then(setDoctors).catch((e) => { onAuthError(e); setDoctors([]); }); }, []);

  const specialties = useMemo(() => [...new Set((doctors || []).map((d) => d.specialty))], [doctors]);
  const list = (doctors || []).filter((d) =>
    (!spec || d.specialty === spec) &&
    (!q || `${d.name} ${d.specialty}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <Hero color={colors.mint}>
        <AvatarStack names={(doctors || []).map((d) => d.name)} size={40} />
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 10 }}>Nuestros médicos</Text>
        <Text style={{ color: 'rgba(255,255,255,0.9)' }}>{doctors ? `${doctors.length} especialistas listos para atenderte` : 'Cargando…'}</Text>
      </Hero>

      <Input icon="🔎" placeholder="Buscar por nombre o especialidad" value={q} onChangeText={setQ} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18, marginBottom: 6 }} contentContainerStyle={{ paddingHorizontal: 18 }}>
        <Chip label="Todos" active={!spec} onPress={() => setSpec(null)} />
        {specialties.map((s) => {
          const x = specialtyStyle(s);
          return <Chip key={s} label={s} icon={x.icon} color={x.color} active={spec === s} onPress={() => setSpec(spec === s ? null : s)} />;
        })}
      </ScrollView>

      {!doctors && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
      {doctors && !list.length && <Muted style={{ textAlign: 'center', marginTop: 20 }}>No encontramos médicos con ese filtro.</Muted>}

      {list.map((d) => {
        const x = specialtyStyle(d.specialty);
        return (
          <View key={d.id} style={st.card}>
            <View style={[st.blob, { backgroundColor: x.soft }]} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={[st.avatarWrap, { backgroundColor: x.soft }]}><Avatar name={d.name} size={64} color={x.color} square border={false} /></View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={st.name}>{d.name}</Text>
                <View style={[st.spec, { backgroundColor: x.soft }]}>
                  <Text style={{ color: x.color, fontWeight: '900', fontSize: 12 }}>{x.icon} {d.specialty}</Text>
                </View>
              </View>
            </View>
            <View style={st.infoRow}>
              <View style={st.info}><Text style={st.infoLabel}>📍 Consultorio</Text><Text style={st.infoValue}>{d.office || '—'}</Text></View>
              <View style={st.info}><Text style={st.infoLabel}>🕐 Horario</Text><Text style={st.infoValue}>{d.startHour}:00 – {d.endHour}:00</Text></View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 }}>
              {[1, 2, 3, 4, 5, 6, 0].map((n) => {
                const on = d.workDays.includes(n);
                return (
                  <View key={n} style={[st.day, on ? { backgroundColor: x.color } : { backgroundColor: '#F1EFF8' }]}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: on ? '#fff' : '#B3B0C4' }}>{DAYS_SHORT[n]}</Text>
                  </View>
                );
              })}
            </View>
            {isPatient && (
              <TouchableOpacity style={[st.bookBtn, { backgroundColor: x.color }]} onPress={() => navigate('book', { specialty: d.specialty, doctorId: d.id })}>
                <Text style={{ color: '#fff', fontWeight: '900' }}>📅 Agendar con {d.name.split(' ').slice(0, 2).join(' ')}</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 16, marginBottom: 14, overflow: 'hidden', ...shadow },
  blob: { position: 'absolute', width: 120, height: 120, borderRadius: 60, right: -40, top: -40 },
  avatarWrap: { borderRadius: 22, padding: 3 },
  name: { fontSize: 17, fontWeight: '900', color: colors.text },
  spec: { alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, marginTop: 6 },
  infoRow: { flexDirection: 'row', marginTop: 14 },
  info: { flex: 1, backgroundColor: '#FAF9FF', borderRadius: 14, padding: 10, marginRight: 8 },
  infoLabel: { fontSize: 11, color: colors.muted, fontWeight: '700' },
  infoValue: { fontSize: 14, color: colors.text, fontWeight: '800', marginTop: 2 },
  day: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 10, marginRight: 6, marginBottom: 6 },
  bookBtn: { marginTop: 10, paddingVertical: 12, borderRadius: 16, alignItems: 'center' },
});
