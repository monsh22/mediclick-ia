import React, { useState } from 'react';
import { ScrollView, View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { api } from '../api';
import { colors, shadow } from '../theme';
import { Button, Input, Muted, ErrorText, Blob } from '../components/ui';

export default function RegisterScreen({ onLogin, goLogin }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (v) => setForm({ ...form, [k]: v });

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      onLogin(await api.register(form));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: colors.purple, paddingTop: 50, paddingBottom: 80, paddingHorizontal: 24, borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden' }}>
          <Blob size={200} color="#fff" opacity={0.08} top={-80} right={-60} />
          <Blob size={50} color={colors.amber} top={36} right={40} />
          <Blob size={20} color={colors.accent} bottom={40} right={110} />
          <Text style={{ fontSize: 40 }}>✨</Text>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#fff', marginTop: 8 }}>Crea tu cuenta</Text>
          <Text style={{ color: '#E4DCFF', marginTop: 4 }}>Agenda tus citas y recibe recordatorios.</Text>
        </View>

        <View style={{ marginHorizontal: 20, marginTop: -50, backgroundColor: '#fff', borderRadius: 26, padding: 20, ...shadow }}>
          <Input icon="👤" label="Nombre completo" value={form.name} onChangeText={set('name')} />
          <Input icon="✉️" label="Correo electrónico" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" />
          <Input icon="🔒" label="Contraseña (mínimo 6)" value={form.password} onChangeText={set('password')} secureTextEntry />
          <ErrorText>{error}</ErrorText>
          <Button title="Registrarme" onPress={submit} loading={loading} />
          <Button title="Ya tengo cuenta" variant="ghost" onPress={goLogin} style={{ marginTop: 6 }} />
        </View>
        <Muted style={{ textAlign: 'center', marginTop: 16, paddingHorizontal: 30, fontSize: 12 }}>
          Tus datos médicos se usan solo para tus citas en MediClick AI.
        </Muted>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
