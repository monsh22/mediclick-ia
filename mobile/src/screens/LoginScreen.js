import React, { useState } from 'react';
import { ScrollView, View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { api } from '../api';
import { API_URL } from '../config';
import { colors, shadow, MEDI_AVATAR } from '../theme';
import { Button, Input, Muted, ErrorText, EmergencyBanner, Blob, Ring, Diamond, Avatar } from '../components/ui';

export default function LoginScreen({ onLogin, goRegister }) {
  const [email, setEmail] = useState('paciente@mediclick.com');
  const [password, setPassword] = useState('Paciente123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      onLogin(await api.login(email, password)); // 👉 publica "usuario.sesion_iniciada" en RabbitMQ
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
        {/* Encabezado con figuras */}
        <View style={{ backgroundColor: colors.primary, paddingTop: 50, paddingBottom: 90, alignItems: 'center', borderBottomLeftRadius: 40, borderBottomRightRadius: 40, overflow: 'hidden' }}>
          <Blob size={220} color="#fff" opacity={0.07} top={-90} left={-60} />
          <Blob size={160} color="#fff" opacity={0.07} bottom={-70} right={-40} />
          <Blob size={54} color={colors.accent} top={40} right={36} />
          <Blob size={22} color={colors.amber} top={120} left={40} />
          <Blob size={14} color="#fff" opacity={0.6} bottom={50} left={90} />
          <Ring size={130} color="#fff" opacity={0.12} top={70} left={-40} width={16} />
          <Diamond size={26} color={colors.rose} bottom={70} right={70} rotate="24deg" />
          <View style={{ backgroundColor: '#fff', borderRadius: 32, padding: 6, transform: [{ rotate: '-6deg' }], ...shadow }}>
            <Avatar uri={MEDI_AVATAR} name="Medi" size={92} square border={false} color={colors.purple} />
          </View>
          <View style={{ backgroundColor: colors.amber, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, marginTop: -10 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 12 }}>¡Hola, soy Medi! 👋</Text>
          </View>
          <Text style={{ fontSize: 32, fontWeight: '900', color: '#fff', marginTop: 16 }}>MediClick <Text style={{ color: colors.amber }}>AI</Text></Text>
          <Text style={{ color: '#CDEFEA', marginTop: 4, fontSize: 15 }}>Tu salud, a un clic de distancia</Text>
        </View>

        {/* Tarjeta de login que se monta sobre el encabezado */}
        <View style={{ marginHorizontal: 20, marginTop: -60, backgroundColor: '#fff', borderRadius: 26, padding: 20, ...shadow }}>
          <Text style={{ fontSize: 20, fontWeight: '900', color: colors.text, marginBottom: 14 }}>Iniciar sesión 👋</Text>
          <Input icon="✉️" label="Correo electrónico" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <Input icon="🔒" label="Contraseña" value={password} onChangeText={setPassword} secureTextEntry />
          <ErrorText>{error}</ErrorText>
          <Button title="Entrar" onPress={submit} loading={loading} />
          <Button title="¿No tienes cuenta? Regístrate" variant="ghost" onPress={goRegister} style={{ marginTop: 6 }} />
        </View>

        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <View style={{ backgroundColor: colors.purpleSoft, borderRadius: 20, padding: 14, marginBottom: 12, flexDirection: 'row' }}>
            <Text style={{ fontSize: 22, marginRight: 10 }}>🧪</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '900', color: colors.purple, marginBottom: 2 }}>Cuentas de prueba</Text>
              <Muted style={{ fontSize: 13 }}>Paciente: paciente@mediclick.com / Paciente123</Muted>
              <Muted style={{ fontSize: 13 }}>Médico: ana.lopez@mediclick.com / Medico123</Muted>
              <Muted style={{ fontSize: 13 }}>Admin: admin@mediclick.com / Admin123</Muted>
            </View>
          </View>
          <EmergencyBanner compact />
          <Muted style={{ textAlign: 'center', fontSize: 11 }}>Servidor: {API_URL}</Muted>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
