import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { setToken } from './src/api';
import { colors } from './src/theme';
import { PastelBackground } from './src/components/ui';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import TriageScreen from './src/screens/TriageScreen';
import BookScreen from './src/screens/BookScreen';
import AppointmentsScreen from './src/screens/AppointmentsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import DoctorsScreen from './src/screens/DoctorsScreen';
import AdminScreen from './src/screens/AdminScreen';

// Pestañas según el rol
const TABS = {
  paciente: [
    { key: 'home', label: 'Inicio', icon: '🏠' },
    { key: 'triage', label: 'Medi IA', icon: '🤖' },
    { key: 'book', label: 'Agendar', icon: '📅' },
    { key: 'appointments', label: 'Mis citas', icon: '🗂️' },
    { key: 'profile', label: 'Perfil', icon: '👤' },
  ],
  medico: [
    { key: 'appointments', label: 'Mi agenda', icon: '🗓️' },
    { key: 'notifications', label: 'Avisos', icon: '🔔' },
    { key: 'profile', label: 'Perfil', icon: '👤' },
  ],
  admin: [
    { key: 'admin', label: 'Panel', icon: '⭐' },
    { key: 'doctors', label: 'Médicos', icon: '🩺' },
    { key: 'profile', label: 'Perfil', icon: '👤' },
  ],
};
const FIRST = { paciente: 'home', medico: 'appointments', admin: 'admin' };

export default function App() {
  const [booting, setBooting] = useState(true);
  const [session, setSession] = useState(null); // { token, user }
  const [authScreen, setAuthScreen] = useState('login');
  const [route, setRoute] = useState({ name: 'home', params: {} });

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('session');
        if (saved) {
          const s = JSON.parse(saved);
          setToken(s.token);
          setSession(s);
          setRoute({ name: FIRST[s.user.role] || 'home', params: {} });
        }
      } catch {
        // si falla el almacenamiento, simplemente pedimos iniciar sesión
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  const onLogin = async (s) => {
    setToken(s.token);
    setSession(s);
    setRoute({ name: FIRST[s.user.role] || 'home', params: {} });
    try { await AsyncStorage.setItem('session', JSON.stringify(s)); } catch {}
  };

  const logout = async () => {
    setToken(null);
    setSession(null);
    setAuthScreen('login');
    try { await AsyncStorage.removeItem('session'); } catch {}
  };

  const navigate = (name, params = {}) => setRoute({ name, params });

  // Si el token expiró, cerramos sesión
  const onAuthError = (e) => { if (e?.status === 401) logout(); };

  if (booting) {
    return <View style={[st.center, { backgroundColor: colors.bg }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  const common = { session, navigate, onAuthError, params: route.params };
  const tabs = TABS[session?.user.role] || TABS.paciente;

  let content;
  if (!session) {
    content = authScreen === 'login'
      ? <LoginScreen onLogin={onLogin} goRegister={() => setAuthScreen('register')} />
      : <RegisterScreen onLogin={onLogin} goLogin={() => setAuthScreen('login')} />;
  } else {
    content = {
      home: <HomeScreen {...common} />,
      triage: <TriageScreen {...common} />,
      book: <BookScreen key={JSON.stringify(route.params)} {...common} />,
      appointments: <AppointmentsScreen {...common} />,
      notifications: <NotificationsScreen {...common} />,
      doctors: <DoctorsScreen {...common} />,
      admin: <AdminScreen {...common} />,
      profile: <ProfileScreen {...common} onLogout={logout} setSession={onLogin} />,
    }[route.name];
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <PastelBackground />
        <View style={{ flex: 1 }}>{content}</View>
        {session && (
          <View style={st.tabbar}>
            {tabs.map((t) => {
              const active = route.name === t.key;
              return (
                <TouchableOpacity key={t.key} style={st.tab} onPress={() => navigate(t.key)} activeOpacity={0.8}>
                  <View style={[st.tabIcon, active && { backgroundColor: colors.primarySoft }]}>
                    <Text style={{ fontSize: 19, opacity: active ? 1 : 0.5 }}>{t.icon}</Text>
                  </View>
                  <Text style={[st.tabLabel, active && { color: colors.primary, fontWeight: '900' }]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabbar: {
    flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 12, marginBottom: 8, marginTop: 4,
    borderRadius: 26, paddingVertical: 6,
    shadowColor: '#3C288C', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  tabIcon: { width: 44, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tabLabel: { fontSize: 10.5, color: colors.muted, marginTop: 2, fontWeight: '700' },
});
