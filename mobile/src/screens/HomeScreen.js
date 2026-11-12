import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { api } from '../api';
import { colors, shadow, specialtyStyle, fmtTime, MEDI_AVATAR } from '../theme';
import { Card, Muted, EmergencyBanner, Hero, Avatar, IconBadge, DateBadge, SectionTitle, Diamond } from '../components/ui';

const ACTIONS = [
  { key: 'triage', label: 'Medi IA', sub: 'Dime qué sientes', icon: '🤖', color: colors.purple, soft: colors.purpleSoft },
  { key: 'book', label: 'Agendar', sub: 'Nueva cita', icon: '📅', color: colors.primary, soft: colors.primarySoft },
  { key: 'doctors', label: 'Médicos', sub: 'Quién atiende', icon: '👩‍⚕️', color: colors.mint, soft: colors.mintSoft },
  { key: 'appointments', label: 'Mis citas', sub: 'Ver y cambiar', icon: '🗂️', color: colors.sky, soft: colors.skySoft },
  { key: 'notifications', label: 'Avisos', sub: 'Recordatorios', icon: '🔔', color: colors.accent, soft: colors.accentSoft },
  { key: 'profile', label: 'Expediente', sub: 'Alergias y más', icon: '📋', color: colors.rose, soft: colors.roseSoft },
];

export default function HomeScreen({ session, navigate, onAuthError }) {
  const [next, setNext] = useState(null);
  const [unread, setUnread] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [specialties, setSpecialties] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const load = useCallback(async () => {
    try {
      const [appts, notifs, specs, docs] = await Promise.all([api.myAppointments(), api.notifications(), api.specialties(), api.doctors()]);
      setDoctors(docs);
      const upcoming = appts
        .filter((a) => a.status === 'programada' && new Date(a.startsAt) > new Date())
        .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
      setNext(upcoming[0] || null);
      setUnread(notifs.filter((n) => !n.read).length);
      setSpecialties(specs);
    } catch (e) {
      onAuthError(e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };
  const firstName = session.user.name.split(' ')[0];
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <ScrollView contentContainerStyle={{ padding: 18 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <Hero>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Avatar name={session.user.name} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={{ color: '#CDEFEA', fontSize: 14 }}>{greet} ☀️</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }}>{firstName}</Text>
          </View>
          <TouchableOpacity onPress={() => navigate('notifications')} style={st.bell}>
            <Text style={{ fontSize: 20 }}>🔔</Text>
            {unread > 0 && <View style={st.badge}><Text style={st.badgeText}>{unread}</Text></View>}
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '800' }}>¿Cómo te sientes hoy?</Text>
            <TouchableOpacity onPress={() => navigate('triage')} style={st.heroBtn} activeOpacity={0.85}>
              <Text style={{ color: colors.primary, fontWeight: '900' }}>💬  Hablar con Medi</Text>
            </TouchableOpacity>
          </View>
          <View style={st.mediBubble}><Avatar uri={MEDI_AVATAR} name="Medi" size={74} square border={false} color={colors.purple} /></View>
        </View>
      </Hero>

      <EmergencyBanner />

      {/* Accesos rápidos de colores */}
      <View style={st.grid}>
        {ACTIONS.map((a) => (
          <TouchableOpacity key={a.key} style={[st.tile, { backgroundColor: a.soft }]} onPress={() => navigate(a.key)} activeOpacity={0.85}>
            <View style={[st.tileDot, { backgroundColor: a.color }]} />
            <Diamond size={16} color={a.color} opacity={0.25} bottom={12} right={14} />
            <View style={[st.tileIcon, { backgroundColor: a.color }]}><Text style={{ fontSize: 20 }}>{a.icon}</Text></View>
            <Text style={[st.tileLabel, { color: a.color }]}>{a.label}</Text>
            <Text style={st.tileSub}>{a.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <SectionTitle>Tu próxima cita</SectionTitle>
      {next ? (
        <TouchableOpacity onPress={() => navigate('appointments')} activeOpacity={0.85}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', borderLeftWidth: 6, borderLeftColor: specialtyStyle(next.specialty).color }}>
            <DateBadge iso={next.startsAt} color={specialtyStyle(next.specialty).color} />
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontWeight: '900', fontSize: 16, color: colors.text }}>{specialtyStyle(next.specialty).icon} {next.specialty}</Text>
              <Muted>{next.doctorName}</Muted>
              <Text style={{ color: colors.primary, fontWeight: '800', marginTop: 4 }}>🕐 {fmtTime(next.startsAt)} · {next.office}</Text>
            </View>
          </Card>
        </TouchableOpacity>
      ) : (
        <Card style={{ alignItems: 'center', paddingVertical: 22 }}>
          <Text style={{ fontSize: 36 }}>📭</Text>
          <Muted style={{ marginTop: 6 }}>No tienes citas próximas</Muted>
          <TouchableOpacity onPress={() => navigate('book')} style={st.smallBtn}>
            <Text style={{ color: '#fff', fontWeight: '900' }}>+ Agendar cita</Text>
          </TouchableOpacity>
        </Card>
      )}

      <SectionTitle right={<TouchableOpacity onPress={() => navigate('doctors')}><Text style={{ color: colors.primary, fontWeight: '800' }}>Ver todos →</Text></TouchableOpacity>}>Nuestros médicos</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 6 }}>
        {doctors.map((d) => {
          const sp = specialtyStyle(d.specialty);
          return (
            <TouchableOpacity key={d.id} onPress={() => navigate('book', { specialty: d.specialty, doctorId: d.id })} style={st.docCard} activeOpacity={0.85}>
              <View style={[st.docTop, { backgroundColor: sp.soft }]}>
                <Avatar name={d.name} size={64} color={sp.color} square border={false} />
              </View>
              <Text style={st.docName} numberOfLines={1}>{d.name}</Text>
              <Text style={[st.docSpec, { color: sp.color }]} numberOfLines={1}>{sp.icon} {d.specialty}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <SectionTitle>Especialidades</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={{ paddingHorizontal: 18 }}>
        {specialties.map((s) => {
          const sp = specialtyStyle(s);
          return (
            <TouchableOpacity key={s} onPress={() => navigate('book', { specialty: s })} style={st.spec} activeOpacity={0.85}>
              <IconBadge icon={sp.icon} color={sp.soft} size={52} />
              <Text style={st.specText} numberOfLines={2}>{s}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  bell: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', right: -4, top: -4, backgroundColor: colors.accent, borderRadius: 10, minWidth: 20, paddingHorizontal: 5, alignItems: 'center', borderWidth: 2, borderColor: colors.primary },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  heroBtn: { backgroundColor: '#fff', alignSelf: 'flex-start', paddingVertical: 11, paddingHorizontal: 16, borderRadius: 14, marginTop: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  tile: { width: '31.5%', borderRadius: 22, padding: 12, marginBottom: 10, overflow: 'hidden' },
  tileIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileLabel: { fontWeight: '900', fontSize: 14 },
  tileSub: { color: colors.muted, fontSize: 11, marginTop: 2 },
  mediBubble: { backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 26, padding: 4, transform: [{ rotate: '6deg' }] },
  docCard: { width: 116, backgroundColor: '#fff', borderRadius: 22, padding: 8, marginRight: 10, alignItems: 'center', ...shadow },
  docTop: { width: '100%', borderRadius: 16, alignItems: 'center', paddingVertical: 8 },
  docName: { fontSize: 12, fontWeight: '900', color: colors.text, marginTop: 8 },
  docSpec: { fontSize: 11, fontWeight: '700', marginTop: 2, marginBottom: 4 },
  tileDot: { position: 'absolute', width: 60, height: 60, borderRadius: 30, right: -18, top: -18, opacity: 0.15 },
  smallBtn: { backgroundColor: colors.primary, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 14, marginTop: 12 },
  spec: { width: 92, alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 6, marginRight: 10, ...shadow },
  specText: { fontSize: 11, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: 8 },
});
