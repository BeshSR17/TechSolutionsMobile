import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  StatusBar, Image, ScrollView,
  Animated, Dimensions,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/auth';


import PerfilScreen      from '../PerfilScreen';
import ChatScreen        from '../ChatScreen';


import ClientesView  from './ClientesView';
import ProyectosView from './ProyectosView';
import TareasView    from './TareasView';
import UsuariosView  from './UsuariosView';

const LOGO_URL = 'https://ycyncrhqawrtgjknstxd.supabase.co/storage/v1/object/public/config/logo.png';
const { width: SCREEN_W } = Dimensions.get('window');
const SIDEBAR_W = 220;

const NAV_ITEMS = [
  { id: 'clientes',  icon: '👥', label: 'Clientes'  },
  { id: 'proyectos', icon: '📁', label: 'Proyectos' },
  { id: 'tareas',    icon: '📋', label: 'Tareas'    },
  { id: 'usuarios',  icon: '👤', label: 'Usuarios'  },
  { id: 'chat',      icon: '💬', label: 'Chat'      },
  { id: 'perfil',    icon: '⚙️', label: 'Perfil'    },
];

export default function AdminDashboard() {
  const { session, perfil } = useAuth();
  const [seccion, setSeccion]               = useState('clientes');
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [noLeidos, setNoLeidos]             = useState(0);
  const [avatarUrl, setAvatarUrl]           = useState(null);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_W)).current;

  const adminId = session?.user?.id;

  // ── Avatar ─────────────────────────────────────────────────────────────────
useEffect(() => {
  if (!adminId) return;

  // Carga inicial
  const cargarAvatar = async () => {
    const { data } = await supabase
      .from('perfiles')
      .select('avatar_url')
      .eq('id', adminId)
      .single();
    if (data?.avatar_url) setAvatarUrl(data.avatar_url);
  };
  cargarAvatar();

  const canalAvatar = supabase
    .channel(`avatar-admin-${adminId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'perfiles',
      filter: `id=eq.${adminId}`,
    }, (payload) => {
      setAvatarUrl(payload.new.avatar_url);
    })
    .subscribe();

  return () => supabase.removeChannel(canalAvatar);
}, [adminId]);

//---- Usuario activo ------
useEffect(() => {
  const marcarActivo = async () => {
    if (adminId) {
      await supabase
        .from('perfiles')
        .update({ estado: 'Activo' })
        .eq('id', adminId);
    }
  };
  marcarActivo();
}, [adminId]);

  // ── Mensajes no leídos ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!adminId) return;
    const contarNoLeidos = async () => {
      const { count } = await supabase
        .from('mensajes')
        .select('id', { count: 'exact', head: true })
        .eq('destinatario_id', adminId)
        .eq('leido', false);
      setNoLeidos(count || 0);
    };
    contarNoLeidos();

    const canal = supabase
      .channel('admin-noti')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes',
        filter: `destinatario_id=eq.${adminId}`,
      }, () => setNoLeidos(prev => prev + 1))
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [adminId]);

  // ── Sidebar animado ────────────────────────────────────────────────────────
  const abrirSidebar = () => {
    setSidebarVisible(true);
    Animated.timing(slideAnim, {
      toValue: 0, duration: 250, useNativeDriver: true,
    }).start();
  };

  const cerrarSidebar = () => {
    Animated.timing(slideAnim, {
      toValue: -SIDEBAR_W, duration: 220, useNativeDriver: true,
    }).start(() => setSidebarVisible(false));
  };

  const navegarA = (id) => {
    setSeccion(id);
    if (id === 'chat') setNoLeidos(0);
    cerrarSidebar();
  };

  const handleLogout = async () => {
    try {
      
      await supabase
        .from('perfiles')
        .update({ estado: 'Inactivo' })
        .eq('id', adminId);

      
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      
      await supabase.auth.signOut();
    }
  };

  const seccionInfo = NAV_ITEMS.find(n => n.id === seccion);

  // ── Render de la sección activa ────────────────────────────────────────────
  const renderSeccion = () => {
    switch (seccion) {
      case 'clientes':  return <ClientesView />;
      case 'proyectos': return <ProyectosView />;
      case 'tareas':    return <TareasView />;
      case 'usuarios':  return <UsuariosView />;
      case 'chat':      return <ChatScreen />;
      case 'perfil':    return <PerfilScreen />;
      default:          return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#06090f" />

      {/* ── TOPBAR ── */}
      <View style={styles.topbar}>
        {/* Botón hamburguesa */}
        <TouchableOpacity style={styles.menuBtn} onPress={abrirSidebar}>
          <View style={styles.hamburger} />
          <View style={[styles.hamburger, { width: 16 }]} />
          <View style={styles.hamburger} />
        </TouchableOpacity>

        {/* Título de sección */}
        <View style={styles.topbarCenter}>
          <Text style={styles.topbarIcon}>{seccionInfo?.icon}</Text>
          <View>
            <Text style={styles.topbarTitle}>{seccionInfo?.label}</Text>
            <Text style={styles.topbarSub}>Panel de Administración</Text>
          </View>
        </View>

        {/* Avatar + badge mensajes */}
        <View style={styles.topbarRight}>
          {noLeidos > 0 && seccion !== 'chat' && (
            <TouchableOpacity style={styles.notiBtn} onPress={() => navegarA('chat')}>
              <Text style={styles.notiText}>{noLeidos > 9 ? '9+' : noLeidos}</Text>
            </TouchableOpacity>
          )}
          <Image
            source={{ uri: avatarUrl || 'https://ui-avatars.com/api/?name=Admin&background=3b82f6&color=fff' }}
            style={styles.avatar}
          />
        </View>
      </View>

      {/* ── CONTENIDO ── */}
      <View style={styles.content}>
        {renderSeccion()}
      </View>

      {/* ── OVERLAY ── */}
      {sidebarVisible && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={cerrarSidebar}
        />
      )}

      {/* ── SIDEBAR DESLIZANTE ── */}
      {sidebarVisible && (
        <Animated.View style={[styles.sidebar, { transform: [{ translateX: slideAnim }] }]}>
          {/* Logo */}
          <View style={styles.sidebarTop}>
            <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />
          </View>

          {/* Nav items */}
          <ScrollView style={styles.nav} showsVerticalScrollIndicator={false}>
            {NAV_ITEMS.map(item => {
              const activo = seccion === item.id;
              const tieneNoti = item.id === 'chat' && noLeidos > 0;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.navItem, activo && styles.navItemActive]}
                  onPress={() => navegarA(item.id)}
                >
                  <Text style={styles.navIcon}>{item.icon}</Text>
                  <Text style={[styles.navLabel, activo && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                  {tieneNoti && (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>
                        {noLeidos > 9 ? '9+' : noLeidos}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Info de usuario + logout */}
          <View style={styles.sidebarBottom}>
            <View style={styles.userChip}>
              <Image
                source={{ uri: avatarUrl || 'https://ui-avatars.com/api/?name=Admin&background=3b82f6&color=fff' }}
                style={styles.chipAvatar}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.chipName} numberOfLines={1}>
                  {perfil?.nombre || session?.user?.user_metadata?.nombre || 'Admin'}
                </Text>
                <Text style={styles.chipRole}>Administrador</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutIcon}>🚪</Text>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* ── BOTTOM TAB BAR ── */}
      <View style={styles.tabBar}>
        {NAV_ITEMS.map(item => {
          const activo = seccion === item.id;
          const tieneNoti = item.id === 'chat' && noLeidos > 0;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.tabItem}
              onPress={() => navegarA(item.id)}
            >
              <View style={styles.tabIconWrap}>
                <Text style={[styles.tabIcon, activo && styles.tabIconActive]}>
                  {item.icon}
                </Text>
                {tieneNoti && <View style={styles.tabBadge} />}
              </View>
              <Text style={[styles.tabLabel, activo && styles.tabLabelActive]}>
                {item.label}
              </Text>
              {activo && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#06090f',
  },

  // ── Topbar ─────────────────────────────────────────────────────────────────
  topbar: {
    height: 60,
    backgroundColor: '#0b0f1a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 12,
  },
  menuBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    gap: 5,
  },
  hamburger: {
    height: 2,
    width: 20,
    backgroundColor: '#64748b',
    borderRadius: 2,
  },
  topbarCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  topbarIcon: {
    fontSize: 20,
  },
  topbarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#e2e8f4',
  },
  topbarSub: {
    fontSize: 10,
    color: '#64748b',
    letterSpacing: 0.5,
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notiBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notiText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
  },

  // ── Contenido ──────────────────────────────────────────────────────────────
  content: {
    flex: 1,
    backgroundColor: '#06090f',
  },

  // ── Overlay ────────────────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 10,
  },

  // ── Sidebar ────────────────────────────────────────────────────────────────
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_W,
    backgroundColor: '#0b0f1a',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.06)',
    zIndex: 20,
    flexDirection: 'column',
  },
  sidebarTop: {
    padding: 20,
    paddingTop: 48,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  logo: {
    width: 130,
    height: 44,
  },
  nav: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  navItemActive: {
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderColor: 'rgba(59,130,246,0.25)',
  },
  navIcon: {
    fontSize: 16,
    width: 22,
    textAlign: 'center',
  },
  navLabel: {
    flex: 1,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748b',
  },
  navLabelActive: {
    color: '#3b82f6',
  },
  navBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  // ── Sidebar bottom ─────────────────────────────────────────────────────────
  sidebarBottom: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    gap: 8,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#151d2e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 10,
  },
  chipAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.4)',
  },
  chipName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f4',
  },
  chipRole: {
    fontSize: 10,
    color: '#64748b',
    letterSpacing: 0.5,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  logoutIcon: { fontSize: 15 },
  logoutText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ef4444',
  },

  // ── Bottom Tab Bar ─────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0b0f1a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 4,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    position: 'relative',
  },
  tabIconWrap: {
    position: 'relative',
  },
  tabIcon: {
    fontSize: 20,
    opacity: 0.4,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: 9,
    color: '#3a4558',
    marginTop: 2,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: '#3b82f6',
  },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    width: 20,
    height: 2,
    backgroundColor: '#3b82f6',
    borderRadius: 1,
  },
  tabBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    borderWidth: 1.5,
    borderColor: '#0b0f1a',
  },
});