import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { api } from '../api';
import { colors, radius, shadow, fmtDate, specialtyStyle } from '../theme';
import { Card, Muted, Button, Input, ErrorText, Hero, Avatar, SectionTitle } from '../components/ui';
// Avatar ahora muestra ilustraciones (con iniciales si no hay internet)

// Próximos 14 días en formato AAAA-MM-DD (hora local)
function nextDays(n = 14) {
  const out = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    const iso = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    out.push({
      iso,
      dow: i === 0 ? 'Hoy' : x.toLocaleDateString('es-MX', { weekday: 'short' }).replace('.', ''),
      day: x.getDate(),
      month: x.toLocaleDateString('es-MX', { month: 'short' }).replace('.', ''),
      sunday: x.getDay() === 0,
    });
  }
  return out;
}

const Step = ({ n, children, color }) => (
  <SectionTitle>
    <Text>
      <Text style={{ color }}>{'● '}</Text>
      {n}. {children}
    </Text>
  </SectionTitle>
);

/**
 * params opcionales:
 *  - specialty: viene sugerida por el triaje
 *  - reschedule: { id, doctorId, specialty, startsAt } para reagendar una cita
 */
export default function BookScreen({ params = {}, navigate, onAuthError }) {
  const resch = params.reschedule;
  const days = useMemo(() => nextDays(), []);
  const [specialties, setSpecialties] = useState([]);
  const [specialty, setSpecialty] = useState(resch?.specialty || params.specialty || null);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState(resch?.doctorId || null);
  const [date, setDate] = useState(days[0].iso);
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);
  const [reason, setReason] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const sp = specialtyStyle(specialty);

  useEffect(() => { api.specialties().then(setSpecialties).catch(onAuthError); }, []);

  useEffect(() => {
    if (!specialty) return;
    api.doctors(specialty).then((list) => {
      setDoctors(list);
      if (!resch) setDoctorId(list.some((d) => d.id === params.doctorId) ? params.doctorId : list[0]?.id || null);
    }).catch(onAuthError);
  }, [specialty]);

  useEffect(() => {
    if (!doctorId) return;
    setLoadingSlots(true);
    setSlot(null);
    api.slots(doctorId, date)
      .then((r) => setSlots(r.slots))
      .catch((e) => { onAuthError(e); setError(e.message); })
      .finally(() => setLoadingSlots(false));
  }, [doctorId, date]);

  const confirm = async () => {
    setError('');
    setSaving(true);
    try {
      if (resch) {
        await api.reschedule(resch.id, slot.startsAt);
        Alert.alert('Cita reagendada 🔄', `Nueva fecha: ${fmtDate(slot.startsAt)}`);
      } else {
        await api.book({ doctorId, startsAt: slot.startsAt, reason });
        Alert.alert('¡Cita agendada! ✅', `Te enviaremos recordatorios 24 h y 2 h antes.\n${fmtDate(slot.startsAt)}`);
      }
      navigate('appointments');
    } catch (e) {
      onAuthError(e);
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const available = slots.filter((s) => s.available).length;

  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
      <Hero color={specialty ? sp.color : colors.primary}>
        <Text style={{ fontSize: 34 }}>{specialty ? sp.icon : '📅'}</Text>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 6 }}>{resch ? 'Reagendar cita' : 'Agendar cita'}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
          {resch ? `Actual: ${fmtDate(resch.startsAt)}` : specialty ? specialty : 'Elige especialidad, médico y horario'}
        </Text>
        {params.specialty && !resch && (
          <View style={st.aiTag}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>✨ Sugerida por el triaje</Text></View>
        )}
      </Hero>

      {!resch && (
        <>
          <Step n={1} color={colors.purple}>Especialidad</Step>
          <View style={st.specGrid}>
            {specialties.map((s) => {
              const x = specialtyStyle(s);
              const active = s === specialty;
              return (
                <TouchableOpacity key={s} onPress={() => setSpecialty(s)} activeOpacity={0.85}
                  style={[st.specTile, { backgroundColor: active ? x.color : x.soft }]}>
                  <Text style={{ fontSize: 24 }}>{x.icon}</Text>
                  <Text numberOfLines={2} style={[st.specLabel, { color: active ? '#fff' : x.color }]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {specialty && !resch && (
        <>
          <Step n={2} color={colors.sky}>Médico</Step>
          {doctors.map((d) => {
            const active = d.id === doctorId;
            return (
              <TouchableOpacity key={d.id} onPress={() => setDoctorId(d.id)} activeOpacity={0.85}>
                <Card style={[{ flexDirection: 'row', alignItems: 'center' }, active && { borderWidth: 2, borderColor: sp.color }]}>
                  <Avatar name={d.name} color={sp.color} size={54} square border={false} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontWeight: '900', color: colors.text, fontSize: 16 }}>{d.name}</Text>
                    <Muted style={{ fontSize: 13 }}>📍 {d.office}</Muted>
                    <Muted style={{ fontSize: 13 }}>🕐 {d.startHour}:00 – {d.endHour}:00 · lun a sáb</Muted>
                  </View>
                  {active && <Text style={{ fontSize: 22 }}>✅</Text>}
                </Card>
              </TouchableOpacity>
            );
          })}
        </>
      )}

      {doctorId && (
        <>
          <Step n={resch ? 1 : 3} color={colors.amber}>Fecha</Step>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -18 }} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 6 }}>
            {days.map((d) => {
              const active = d.iso === date;
              return (
                <TouchableOpacity key={d.iso} onPress={() => setDate(d.iso)}
                  style={[st.day, active && { backgroundColor: sp.color }, d.sunday && !active && { opacity: 0.45 }]}>
                  <Text style={[st.dayDow, active && { color: '#fff' }]}>{d.dow}</Text>
                  <Text style={[st.dayNum, active && { color: '#fff' }]}>{d.day}</Text>
                  <Text style={[st.dayDow, active && { color: '#fff' }]}>{d.month}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Step n={resch ? 2 : 4} color={colors.accent}>Horario</Step>
          {loadingSlots ? <ActivityIndicator color={sp.color} /> : (
            slots.length === 0 ? (
              <Card style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 30 }}>😴</Text>
                <Muted>El médico no atiende este día. Elige otra fecha.</Muted>
              </Card>
            ) : (
              <>
                <Muted style={{ marginBottom: 8 }}>{available} horarios libres</Muted>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {slots.map((s) => {
                    const active = slot?.startsAt === s.startsAt;
                    return (
                      <TouchableOpacity
                        key={s.startsAt}
                        disabled={!s.available}
                        onPress={() => setSlot(s)}
                        style={[st.slot, { borderColor: sp.color }, !s.available && st.slotOff, active && { backgroundColor: sp.color }]}
                      >
                        <Text style={[st.slotText, { color: sp.color }, !s.available && { color: '#B4C0CC', textDecorationLine: 'line-through' }, active && { color: '#fff' }]}>{s.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )
          )}
        </>
      )}

      {slot && (
        <Card style={{ marginTop: 14, backgroundColor: sp.soft }}>
          <Text style={{ fontWeight: '900', color: sp.color, marginBottom: 10 }}>Resumen: {sp.icon} {specialty} · {fmtDate(slot.startsAt)}</Text>
          {!resch && <Input icon="📝" label="Motivo de consulta (opcional)" value={reason} onChangeText={setReason} placeholder="Ej. Dolor de rodilla al caminar" />}
          <ErrorText>{error}</ErrorText>
          <Button title={resch ? `Reagendar a las ${slot.label}` : `Confirmar cita ${slot.label}`} onPress={confirm} loading={saving} style={{ backgroundColor: sp.color, borderColor: sp.color }} />
        </Card>
      )}
      {!slot && <ErrorText>{error}</ErrorText>}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  aiTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', paddingVertical: 5, paddingHorizontal: 10, borderRadius: 999, marginTop: 10 },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  specTile: { width: '31.5%', borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6, alignItems: 'center', marginBottom: 10 },
  specLabel: { fontSize: 11, fontWeight: '800', textAlign: 'center', marginTop: 6 },
  day: { width: 64, paddingVertical: 12, marginRight: 8, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', ...shadow },
  dayDow: { fontSize: 11, color: colors.muted, textTransform: 'capitalize', fontWeight: '700' },
  dayNum: { fontSize: 22, fontWeight: '900', color: colors.text },
  slot: { width: '22%', marginRight: '3%', marginBottom: 10, paddingVertical: 11, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, alignItems: 'center' },
  slotOff: { borderColor: colors.border, backgroundColor: '#F1F5F9' },
  slotText: { fontWeight: '800' },
});
