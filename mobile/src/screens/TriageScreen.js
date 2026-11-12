import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Linking, StyleSheet, ActivityIndicator } from 'react-native';
import { api } from '../api';
import { colors, radius, shadow, specialtyStyle, MEDI_AVATAR } from '../theme';
import { Blob, Ring, Diamond, Avatar } from '../components/ui';
import { MediCard } from '../components/MediCards';

const STARTERS = [
  ['👋', '¿Qué puedes hacer?'],
  ['🤕', 'Me duele la cabeza'],
  ['👩‍⚕️', '¿Qué médicos hay?'],
  ['📅', 'Quiero agendar una cita'],
  ['🗂️', '¿Qué citas tengo?'],
  ['🌾', 'Quiero registrar mis alergias'],
];

// Muestra en negritas el texto entre **asteriscos**
function RichText({ text, color }) {
  return (
    <Text style={{ color, fontSize: 15, lineHeight: 22 }}>
      {text.split('**').map((part, i) => (
        <Text key={i} style={i % 2 ? { fontWeight: '900' } : null}>{part}</Text>
      ))}
    </Text>
  );
}

const MediAvatar = ({ size = 34 }) => <Avatar uri={MEDI_AVATAR} name="Medi" size={size} color={colors.purple} square border={false} />;

// Puntitos animados de "escribiendo…"
function Typing() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
      <MediAvatar size={32} />
      <View style={[st.bubble, st.bot, { marginLeft: 8, flexDirection: 'row', alignItems: 'center' }]}>
        <ActivityIndicator color={colors.purple} size="small" />
        <Text style={{ color: colors.muted, marginLeft: 8 }}>Medi está escribiendo…</Text>
      </View>
    </View>
  );
}

export default function TriageScreen({ session, navigate, onAuthError }) {
  const firstName = session.user.name.split(' ')[0];
  const [messages, setMessages] = useState([{
    id: 'w',
    role: 'assistant',
    content: `¡Hola, ${firstName}! 👋 Soy **Medi**, tu asistente de MediClick 🩺✨\n\nPuedo orientarte si te sientes mal, mostrarte médicos y horarios, agendar tus citas y guardar tu expediente. ¿En qué te ayudo?`,
  }]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  const send = async (preset) => {
    const msg = (preset ?? text).trim();
    if (!msg || loading) return;
    const history = messages.filter((m) => m.id !== 'w').map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { id: `${Date.now()}`, role: 'user', content: msg }]);
    setText('');
    setLoading(true);
    try {
      const r = await api.assistant(msg, history);
      setMessages((prev) => [...prev, { id: `${Date.now()}a`, role: 'assistant', content: r.reply, meta: r }]);
    } catch (e) {
      onAuthError(e);
      setMessages((prev) => [...prev, { id: `${Date.now()}e`, role: 'assistant', content: `⚠️ ${e.message}` }]);
    } finally {
      setLoading(false);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 150);
    }
  };

  const lastBotId = [...messages].reverse().find((m) => m.role === 'assistant')?.id;

  const renderItem = ({ item }) => {
    const mine = item.role === 'user';
    const meta = item.meta;
    const sp = meta?.specialty ? specialtyStyle(meta.specialty) : null;

    if (mine) {
      return (
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 }}>
          <View style={[st.bubble, st.mine]}><RichText text={item.content} color="#fff" /></View>
        </View>
      );
    }

    return (
      <View style={{ flexDirection: 'row', marginBottom: 14 }}>
        <View style={{ marginRight: 8, marginTop: 2 }}><MediAvatar size={32} /></View>
        <View style={{ flex: 1 }}>
          <View style={[st.bubble, st.bot, meta?.emergency && st.emergency, { alignSelf: 'flex-start' }]}>
            <RichText text={item.content} color={colors.text} />
          </View>

          {meta?.emergency && (
            <>
              <TouchableOpacity style={st.callBtn} onPress={() => Linking.openURL('tel:911')}>
                <Text style={st.callText}>📞 Llamar al 911 ahora</Text>
              </TouchableOpacity>
              {meta.emergencyType === 'salud_mental' && (
                <TouchableOpacity style={[st.callBtn, { backgroundColor: colors.purple }]} onPress={() => Linking.openURL('tel:8009112000')}>
                  <Text style={st.callText}>💬 Línea de la Vida 800 911 2000</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Especialidad recomendada (cuando Medi orienta) */}
          {sp && !meta.emergency && !meta.cards?.some((c) => c.type === 'slots') && (
            <TouchableOpacity style={[st.suggest, { backgroundColor: sp.soft, borderColor: sp.color }]} onPress={() => send(`Quiero ver horarios de ${meta.specialty}`)}>
              <View style={st.specIcon}><Text style={{ fontSize: 22 }}>{sp.icon}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: sp.color, fontWeight: '900' }}>{meta.specialty}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>Ver horarios disponibles</Text>
              </View>
              <Text style={{ color: sp.color, fontWeight: '900', fontSize: 18 }}>→</Text>
            </TouchableOpacity>
          )}

          {/* Tarjetas interactivas: horarios, médicos, cita, expediente… */}
          {meta?.cards?.map((c, i) => <MediCard key={`${item.id}-${i}`} card={c} onSend={send} navigate={navigate} />)}

          {/* Respuestas rápidas (solo en el último mensaje) */}
          {item.id === lastBotId && !loading && meta?.suggestions?.length > 0 && (
            <View style={st.sugRow}>
              {meta.suggestions.map((s) => (
                <TouchableOpacity key={s} style={st.sugChip} onPress={() => send(s)}>
                  <Text style={st.sugText}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {meta?.mode && (
            <Text style={st.mode}>
              {meta.mode === 'llm' ? `✨ IA Groq${meta.tools?.length ? ` · usó: ${[...new Set(meta.tools)].join(', ')}` : ''}` : meta.mode === 'reglas' ? '🛡️ Filtro de emergencias' : '📚 Modo local (RAG)'}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={80}>
      {/* Encabezado */}
      <View style={st.header}>
        <Blob size={130} color="#fff" opacity={0.1} top={-50} right={-20} />
        <Ring size={70} color="#fff" opacity={0.15} bottom={-30} left={90} width={10} />
        <Diamond size={20} color={colors.amber} top={14} right={96} />
        <View style={st.headerAvatar}><MediAvatar size={48} /></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 19 }}>Medi</Text>
          <Text style={{ color: '#E4DCFF', fontSize: 12 }}>● En línea · Orienta, no diagnostica</Text>
        </View>
        <TouchableOpacity onPress={() => Linking.openURL('tel:911')} style={st.sosMini}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>🚨 911</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        ListFooterComponent={
          <>
            {loading && <Typing />}
            {messages.length === 1 && !loading && (
              <View style={[st.sugRow, { marginLeft: 40 }]}>
                {STARTERS.map(([icon, label]) => (
                  <TouchableOpacity key={label} style={st.sugChip} onPress={() => send(label)}>
                    <Text style={st.sugText}>{icon} {label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        }
      />
      <View style={st.inputRow}>
        <View style={{ marginRight: 8 }}><Avatar name={session.user.name} size={38} /></View>
        <TextInput
          style={st.input}
          value={text}
          onChangeText={setText}
          placeholder="Escríbele a Medi…"
          placeholderTextColor="#A3AEC0"
          multiline
        />
        <TouchableOpacity style={[st.send, (!text.trim() || loading) && { opacity: 0.5 }]} onPress={() => send()} disabled={loading}>
          <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>➤</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.purple, margin: 14, marginBottom: 0, padding: 14, paddingRight: 16, borderRadius: 26, overflow: 'hidden' },
  headerAvatar: { borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', padding: 3 },
  sosMini: { backgroundColor: colors.danger, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12 },
  bubble: { padding: 14, borderRadius: radius, maxWidth: '100%' },
  mine: { backgroundColor: colors.primary, borderBottomRightRadius: 6, maxWidth: '82%' },
  bot: { backgroundColor: '#fff', borderBottomLeftRadius: 6, ...shadow },
  emergency: { backgroundColor: colors.dangerSoft, borderWidth: 1.5, borderColor: '#F5B5B5' },
  callBtn: { backgroundColor: colors.danger, padding: 13, borderRadius: 16, alignItems: 'center', marginTop: 8 },
  callText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  suggest: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5 },
  specIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: '#fff' },
  mode: { fontSize: 10, color: colors.muted, marginTop: 6, marginLeft: 4 },
  sugRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  sugChip: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#D9CFFF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, marginRight: 8, marginBottom: 8 },
  sugText: { color: colors.purple, fontWeight: '800', fontSize: 13 },
  inputRow: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'flex-end', borderTopLeftRadius: 24, borderTopRightRadius: 24, ...shadow },
  input: { flex: 1, maxHeight: 110, backgroundColor: colors.bg, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: colors.text, marginRight: 8 },
  send: { backgroundColor: colors.purple, width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
