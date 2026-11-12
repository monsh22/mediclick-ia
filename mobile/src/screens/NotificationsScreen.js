import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { api } from '../api';
import { colors, fmtDate } from '../theme';
import { Card, Muted, Hero, IconBadge } from '../components/ui';

// Color e ícono según el tipo de aviso
const KIND = {
  'cita.creada': { icon: '✅', soft: colors.successSoft, color: colors.success },
  'cita.cancelada': { icon: '❌', soft: colors.dangerSoft, color: colors.danger },
  'cita.reagendada': { icon: '🔄', soft: colors.skySoft, color: colors.sky },
  recordatorio: { icon: '⏰', soft: colors.amberSoft, color: colors.amber },
  'usuario.sesion_iniciada': { icon: '🔐', soft: colors.purpleSoft, color: colors.purple },
  'triaje.emergencia_detectada': { icon: '🚨', soft: colors.dangerSoft, color: colors.danger },
};

// Quita el emoji del inicio del título (ya lo mostramos en el ícono)
const cleanTitle = (t = '') => t.replace(/^\S+\s/, '');

export default function NotificationsScreen({ onAuthError }) {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.notifications());
      api.readNotifications().catch(() => {});
    } catch (e) {
      onAuthError(e);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000); // se actualiza cada 10 s para ver llegar los recordatorios
    return () => clearInterval(t);
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={{ padding: 18 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
    >
      <Hero color={colors.accent}>
        <Text style={{ fontSize: 32 }}>🔔</Text>
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 6 }}>Notificaciones</Text>
        <Text style={{ color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>Confirmaciones, recordatorios 24 h / 2 h e inicios de sesión</Text>
      </Hero>

      {items.length === 0 && (
        <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
          <Text style={{ fontSize: 38 }}>🔕</Text>
          <Muted style={{ marginTop: 6 }}>Aún no tienes notificaciones.</Muted>
        </Card>
      )}
      {items.map((n) => {
        const k = KIND[n.event] || { icon: '📌', soft: colors.border, color: colors.muted };
        return (
          <Card key={n.id} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <IconBadge icon={k.icon} color={k.soft} size={44} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontWeight: '900', color: k.color, flex: 1 }}>{cleanTitle(n.title)}</Text>
                {!n.read && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent }} />}
              </View>
              <Muted style={{ marginTop: 2, fontSize: 13 }}>{n.body}</Muted>
              <Text style={{ fontSize: 11, color: colors.muted, marginTop: 6 }}>{fmtDate(n.createdAt)}</Text>
            </View>
          </Card>
        );
      })}
    </ScrollView>
  );
}
