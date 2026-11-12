// Tarjetas interactivas que Medi muestra dentro del chat
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { colors, shadow, specialtyStyle } from '../theme';
import { Avatar } from './ui';

const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1);

/** Horarios libres: pestañas por día + botones de hora por médico */
function SlotsCard({ card, onSend }) {
  const [day, setDay] = useState(0);
  const sp = specialtyStyle(card.especialidad);
  const d = card.dias?.[day];
  if (!card.dias?.length) {
    return <View style={[st.card, { backgroundColor: sp.soft }]}><Text style={st.muted}>😴 No hay horarios libres en esas fechas.</Text></View>;
  }
  return (
    <View style={st.card}>
      <View style={[st.head, { backgroundColor: sp.soft }]}>
        <Text style={{ fontSize: 18 }}>{sp.icon}</Text>
        <Text style={[st.headText, { color: sp.color }]}>Horarios de {card.especialidad}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 10 }}>
        {card.dias.map((x, i) => (
          <TouchableOpacity key={x.fecha} onPress={() => setDay(i)} style={[st.dayTab, i === day && { backgroundColor: sp.color }]}>
            <Text style={[st.dayText, i === day && { color: '#fff' }]}>{cap(x.dia.split(',')[0])}</Text>
            <Text style={[st.daySub, i === day && { color: '#fff' }]}>{x.dia.split(',')[1]?.trim()}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {d?.medicos.map((m) => (
        <View key={m.doctorId} style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Avatar name={m.medico} size={34} color={sp.color} square border={false} />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={st.bold}>{m.medico}</Text>
              <Text style={st.small}>📍 {m.consultorio}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {m.horasLibres.slice(0, 8).map((h) => (
              <TouchableOpacity
                key={h}
                style={[st.time, { borderColor: sp.color }]}
                onPress={() => onSend(`Quiero agendar con ${m.medico} el ${d.dia} (${d.fecha}) a las ${h}`)}
              >
                <Text style={{ color: sp.color, fontWeight: '900' }}>{h}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <Text style={[st.small, { padding: 12, paddingTop: 4 }]}>👆 Toca una hora y Medi te pedirá confirmar</Text>
    </View>
  );
}

/** Médicos con su avatar */
function DoctorsCard({ card, onSend }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ paddingRight: 10 }}>
      {card.medicos?.map((m) => {
        const sp = specialtyStyle(m.especialidad);
        return (
          <TouchableOpacity key={m.doctorId} style={st.doc} onPress={() => onSend(`¿Qué horarios tiene ${m.nombre}?`)} activeOpacity={0.85}>
            <View style={[st.docTop, { backgroundColor: sp.soft }]}><Avatar name={m.nombre} size={58} color={sp.color} square border={false} /></View>
            <Text style={[st.bold, { fontSize: 12, marginTop: 6 }]} numberOfLines={1}>{m.nombre}</Text>
            <Text style={{ fontSize: 11, color: sp.color, fontWeight: '800' }} numberOfLines={1}>{sp.icon} {m.especialidad}</Text>
            <Text style={st.small}>🕐 {m.horario}</Text>
            <Text style={[st.small, { color: colors.primary, fontWeight: '800', marginTop: 4 }]}>Ver horarios →</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/** Cita agendada / cancelada / reagendada */
function AppointmentCard({ card, navigate }) {
  const c = card.cita || {};
  const sp = specialtyStyle(c.especialidad);
  const cancelled = c.estado === 'cancelada';
  return (
    <View style={[st.card, { borderLeftWidth: 6, borderLeftColor: cancelled ? colors.danger : sp.color }]}>
      <View style={{ padding: 12 }}>
        <Text style={[st.headText, { color: cancelled ? colors.danger : sp.color, marginLeft: 0 }]}>{card.titulo}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
          <Avatar name={c.medico} size={46} color={sp.color} square border={false} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={st.bold}>{sp.icon} {c.especialidad}</Text>
            <Text style={st.small}>{c.medico} · {c.consultorio}</Text>
            <Text style={{ color: colors.text, fontWeight: '800', marginTop: 2 }}>📅 {cap(c.cuando || '')}</Text>
          </View>
        </View>
        {!cancelled && <Text style={[st.small, { marginTop: 8 }]}>🔔 Te recordaremos 24 h y 2 h antes.</Text>}
        <TouchableOpacity style={[st.action, { backgroundColor: sp.soft }]} onPress={() => navigate('appointments')}>
          <Text style={{ color: sp.color, fontWeight: '900' }}>🗂️ Ver mis citas</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/** Lista de próximas citas */
function AppointmentsCard({ card, onSend }) {
  if (!card.citas?.length) return <View style={st.card}><Text style={[st.muted, { padding: 12 }]}>📭 No tienes citas próximas.</Text></View>;
  return (
    <View style={st.card}>
      <View style={[st.head, { backgroundColor: colors.skySoft }]}><Text style={[st.headText, { color: colors.sky }]}>🗂️ Tus próximas citas</Text></View>
      {card.citas.map((c) => {
        const sp = specialtyStyle(c.especialidad);
        return (
          <View key={c.citaId} style={st.row}>
            <View style={[st.dot, { backgroundColor: sp.soft }]}><Text>{sp.icon}</Text></View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={st.bold}>{c.especialidad}</Text>
              <Text style={st.small}>{cap(c.cuando)} · {c.medico}</Text>
            </View>
            <TouchableOpacity onPress={() => onSend(`Quiero cancelar mi cita de ${c.especialidad} del ${c.cuando}`)}>
              <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 12 }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        );
      })}
    </View>
  );
}

/** Expediente médico */
function RecordCard({ card, navigate }) {
  const e = card.expediente || {};
  const rows = [
    ['🩸', 'Tipo de sangre', e.tipoSangre], ['🌾', 'Alergias', e.alergias], ['🫀', 'Enfermedades crónicas', e.enfermedadesCronicas],
    ['💊', 'Medicamentos', e.medicamentosActuales], ['📱', 'Teléfono', e.telefono], ['🆘', 'Contacto de emergencia', e.contactoEmergencia],
  ];
  return (
    <View style={st.card}>
      <View style={[st.head, { backgroundColor: colors.roseSoft }]}><Text style={[st.headText, { color: colors.rose }]}>{card.titulo || '📋 Tu expediente'}</Text></View>
      {rows.map(([icon, label, val]) => (
        <View key={label} style={st.recRow}>
          <Text style={{ width: 26 }}>{icon}</Text>
          <Text style={[st.small, { flex: 1 }]}>{label}</Text>
          <Text style={[st.bold, { flex: 1.3, textAlign: 'right', color: val ? colors.text : '#B3B0C4' }]}>{val || 'sin registrar'}</Text>
        </View>
      ))}
      <TouchableOpacity style={[st.action, { backgroundColor: colors.roseSoft, margin: 12 }]} onPress={() => navigate('profile')}>
        <Text style={{ color: colors.rose, fontWeight: '900' }}>✏️ Editar en mi perfil</Text>
      </TouchableOpacity>
    </View>
  );
}

export function MediCard({ card, onSend, navigate }) {
  switch (card.type) {
    case 'slots': return <SlotsCard card={card} onSend={onSend} />;
    case 'doctors': return <DoctorsCard card={card} onSend={onSend} />;
    case 'appointment': return <AppointmentCard card={card} navigate={navigate} />;
    case 'appointments': return <AppointmentsCard card={card} onSend={onSend} />;
    case 'record': return <RecordCard card={card} navigate={navigate} />;
    default: return null;
  }
}

const st = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 20, marginTop: 8, overflow: 'hidden', ...shadow },
  head: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  headText: { fontWeight: '900', fontSize: 14, marginLeft: 6 },
  dayTab: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14, backgroundColor: '#F4F2FB', marginRight: 8, alignItems: 'center' },
  dayText: { fontWeight: '900', color: colors.text, fontSize: 13 },
  daySub: { fontSize: 11, color: colors.muted },
  time: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12, marginRight: 8, marginBottom: 8, backgroundColor: '#fff' },
  bold: { fontWeight: '900', color: colors.text, fontSize: 14 },
  small: { fontSize: 12, color: colors.muted },
  muted: { color: colors.muted, padding: 12 },
  doc: { width: 130, backgroundColor: '#fff', borderRadius: 20, padding: 8, marginRight: 10, ...shadow },
  docTop: { borderRadius: 14, alignItems: 'center', paddingVertical: 8 },
  action: { marginTop: 10, paddingVertical: 10, borderRadius: 14, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: '#F1EFF8' },
  dot: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  recRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F6F4FC' },
});
