// screens/user/UserDashboard.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Image, StatusBar, Animated, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/auth';

import MisTareasScreen from '../MisTareasScreen';
import ChatScreen      from '../ChatScreen';
import PerfilScreen    from '../PerfilScreen';

const { width: SCREEN_W } = Dimensions.get('window');
const SIDEBAR_W = 230;

const NAV_ITEMS = [
  { id: 'tareas', icon: '✅', label: 'Mis Tareas'    },
  { id: 'chat',   icon: '💬', label: 'Chat de Dudas'  },
  { id: 'perfil', icon: '⚙️', label: 'Configuración'  },
];

const LOGO_URL = 'https://ycyncrhqawrtgjknstxd.supabase.co/storage/v1/object/public/config/logo.png';

export default function UserDashboard() {
  const { session, perfil } = useAuth();
  const [seccion,        setSeccion]        = useState('tareas');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [avatarUrl,      setAvatarUrl]      = useState(null);
  const [noLeidos,       setNoLeidos]       = useState(0);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_W)).current;
  const seccionRef = useRef(seccion);

  const userId = session?.user?.id;

  useEffect(() => { seccionRef.current = seccion; }, [seccion]);

  // ── Avatar desde perfil ────────────────────────────────────────────────────
  
  useEffect(() => {
    if (!userId) return;

    const cargarAvatar = async () => {
      const { data } = await supabase.from('perfiles').select('avatar_url').eq('id', userId).single();
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    };
    cargarAvatar();

    const canalPerfil = supabase
      .channel(`mi-perfil-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'perfiles',
        filter: `id=eq.${userId}`,
      }, (payload) => {
        
        if (payload.new.avatar_url) setAvatarUrl(payload.new.avatar_url);
        
      })
      .subscribe();

    return () => supabase.removeChannel(canalPerfil);
  }, [userId]);

// ----------- usuario activo -----------
  useEffect(() => {
    const setOnline = async () => {
      if (userId) {
        await supabase
          .from('perfiles')
          .update({ estado: 'Activo' })
          .eq('id', userId);
      }
    };
    setOnline();
  }, [userId]);

  // ── Mensajes no leídos ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const contar = async () => {
      const { count } = await supabase
        .from('mensajes')
        .select('id', { count: 'exact', head: true })
        .eq('destinatario_id', userId)
        .eq('leido', false);
      setNoLeidos(count || 0);
    };
    contar();

    const canal = supabase
      .channel('user-noti')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes',
        filter: `destinatario_id=eq.${userId}`,
      }, () => {
        if (seccionRef.current !== 'chat') setNoLeidos(prev => prev + 1);
      })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [userId]);

  // ── Sidebar animado ────────────────────────────────────────────────────────
  const abrirSidebar = () => {
    setSidebarVisible(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
  };

  const cerrarSidebar = () => {
    Animated.timing(slideAnim, { toValue: -SIDEBAR_W, duration: 220, useNativeDriver: true })
      .start(() => setSidebarVisible(false));
  };

  const navegarA = (id) => {
    setSeccion(id);
    if (id === 'chat') setNoLeidos(0);
    cerrarSidebar();
  };

  const handleLogout = async () => {
    await supabase
      .from('perfiles')
      .update({ estado: 'Inactivo' })
      .eq('id', userId);

    await supabase.auth.signOut();

  };

  const seccionInfo = NAV_ITEMS.find(n => n.id === seccion);
  const nombreUsuario = perfil?.nombre || session?.user?.user_metadata?.nombre || 'Colaborador';

  const renderSeccion = () => {
    switch (seccion) {
      case 'tareas': return <MisTareasScreen />;
      case 'chat':   return <ChatScreen />;
      case 'perfil': return <PerfilScreen />;
      default:       return null;
    }
  };

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#06090f" />

      {/* ── TOPBAR ── */}
      <View style={s.topbar}>
        <TouchableOpacity style={s.menuBtn} onPress={abrirSidebar}>
          <View style={s.hamburger} />
          <View style={[s.hamburger, { width: 16 }]} />
          <View style={s.hamburger} />
        </TouchableOpacity>

        <View style={s.topbarCenter}>
          <Text style={s.topbarIcon}>{seccionInfo?.icon}</Text>
          <View>
            <Text style={s.topbarTitle}>{seccionInfo?.label}</Text>
            <Text style={s.topbarSub}>Portal del Colaborador</Text>
          </View>
        </View>

        <View style={s.topbarRight}>
          {noLeidos > 0 && seccion !== 'chat' && (
            <TouchableOpacity style={s.notiBtn} onPress={() => navegarA('chat')}>
              <Text style={s.notiText}>{noLeidos > 9 ? '9+' : noLeidos}</Text>
            </TouchableOpacity>
          )}
          <Image
            source={{ uri: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreUsuario)}&background=10b981&color=fff` }}
            style={s.avatar}
          />
        </View>
      </View>

      {/* ── CONTENIDO ── */}
      <View style={s.content}>
        {renderSeccion()}
      </View>

      {/* ── OVERLAY ── */}
      {sidebarVisible && (
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={cerrarSidebar}
        />
      )}

      {/* ── SIDEBAR DESLIZANTE ── */}
      {sidebarVisible && (
        <Animated.View style={[s.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          <View style={s.sidebarTop}>
            <Image source={{ uri: LOGO_URL }} style={s.logo} resizeMode="contain" />
          </View>

          {/* Chip de usuario */}
          <View style={s.userChip}>
            <Image
              source={{ uri: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(nombreUsuario)}&background=10b981&color=fff` }}
              style={s.chipAvatar}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.chipName} numberOfLines={1}>{nombreUsuario}</Text>
              <Text style={s.chipRole}>Colaborador</Text>
            </View>
          </View>

          {/* Nav */}
          <View style={s.nav}>
            {NAV_ITEMS.map(item => {
              const activo     = seccion === item.id;
              const tieneNoti  = item.id === 'chat' && noLeidos > 0;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[s.navItem, activo && s.navItemActive]}
                  onPress={() => navegarA(item.id)}
                >
                  <Text style={s.navIcon}>{item.icon}</Text>
                  <Text style={[s.navLabel, activo && s.navLabelActive]}>{item.label}</Text>
                  {tieneNoti && (
                    <View style={s.navBadge}>
                      <Text style={s.navBadgeText}>{noLeidos > 9 ? '9+' : noLeidos}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Logout */}
          <View style={s.sidebarBottom}>
            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
              <Text style={s.logoutIcon}>🚪</Text>
              <Text style={s.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── BOTTOM TAB BAR ── */}
      <View style={s.tabBar}>
        {NAV_ITEMS.map(item => {
          const activo    = seccion === item.id;
          const tieneNoti = item.id === 'chat' && noLeidos > 0;
          return (
            <TouchableOpacity
              key={item.id}
              style={s.tabItem}
              onPress={() => navegarA(item.id)}
            >
              <View style={s.tabIconWrap}>
                <Text style={[s.tabIcon, activo && s.tabIconActive]}>{item.icon}</Text>
                {tieneNoti && <View style={s.tabBadge} />}
              </View>
              <Text style={[s.tabLabel, activo && s.tabLabelActive]}>{item.label}</Text>
              {activo && <View style={s.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#06090f' },

  // Topbar
  topbar: {
    height: 60, backgroundColor: '#080d14',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12,
  },
  menuBtn:      { width: 36, height: 36, justifyContent: 'center', gap: 5 },
  hamburger:    { height: 2, width: 20, backgroundColor: '#64748b', borderRadius: 2 },
  topbarCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  topbarIcon:   { fontSize: 20 },
  topbarTitle:  { fontSize: 15, fontWeight: '700', color: '#ddeeff' },
  topbarSub:    { fontSize: 10, color: '#5a7a8a', letterSpacing: 0.5 },
  topbarRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  notiBtn: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 12, minWidth: 24, height: 24,
    paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center',
  },
  notiText: { color: '#34d399', fontSize: 11, fontWeight: '700' },
  avatar: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 2, borderColor: 'rgba(16,185,129,0.4)',
  },

  // Contenido
  content: { flex: 1, backgroundColor: '#06090f' },

  // Overlay
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 10 },

  // Sidebar
  sidebar: {
    position: 'absolute', left: 0, top: 0, bottom: 0,
    width: SIDEBAR_W, backgroundColor: '#080d14',
    borderRightWidth: 1, borderRightColor: 'rgba(16,185,129,0.15)',
    zIndex: 20, flexDirection: 'column',
  },
  sidebarTop: {
    padding: 20, paddingTop: 48,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  logo: { width: 130, height: 44 },

  userChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#111c2a', borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.15)', borderRadius: 12,
    padding: 12, margin: 12,
  },
  chipAvatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: 'rgba(16,185,129,0.4)',
  },
  chipName: { fontSize: 13, fontWeight: '700', color: '#ddeeff' },
  chipRole: { fontSize: 10, color: '#10b981', letterSpacing: 0.5 },

  nav: { flex: 1, paddingVertical: 8, paddingHorizontal: 10 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 11, paddingHorizontal: 12,
    borderRadius: 10, marginBottom: 2,
    borderWidth: 1, borderColor: 'transparent',
  },
  navItemActive: { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.25)' },
  navIcon:       { fontSize: 16, width: 22, textAlign: 'center' },
  navLabel:      { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#5a7a8a' },
  navLabelActive:{ color: '#10b981' },
  navBadge: {
    backgroundColor: '#10b981', borderRadius: 9,
    minWidth: 18, height: 18, paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  navBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  sidebarBottom: { padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  logoutIcon: { fontSize: 15 },
  logoutText: { fontSize: 13, fontWeight: '600', color: '#ef4444' },

  // Bottom Tab Bar
  tabBar: {
    flexDirection: 'row', backgroundColor: '#080d14',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingBottom: 4,
  },
  tabItem:        { flex: 1, alignItems: 'center', paddingVertical: 8, position: 'relative' },
  tabIconWrap:    { position: 'relative' },
  tabIcon:        { fontSize: 20, opacity: 0.4 },
  tabIconActive:  { opacity: 1 },
  tabLabel:       { fontSize: 9, color: '#2a3a4a', marginTop: 2, fontWeight: '600' },
  tabLabelActive: { color: '#10b981' },
  tabIndicator: {
    position: 'absolute', top: 0,
    width: 20, height: 2,
    backgroundColor: '#10b981', borderRadius: 1,
  },
  tabBadge: {
    position: 'absolute', top: -2, right: -4,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#10b981', borderWidth: 1.5, borderColor: '#080d14',
  },
});