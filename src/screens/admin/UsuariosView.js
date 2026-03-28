// screens/admin/UsuariosView.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  TextInput, ActivityIndicator, Alert, Modal, ScrollView, RefreshControl,
} from 'react-native';
import { getPerfiles } from '../../services/api';
import { supabase } from '../../services/auth';

const ESTADO_CFG = {
  'Activo':   { color: '#10b981', bg: 'rgba(16,185,129,0.12)', dot: '#10b981' },
  'Inactivo': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  dot: '#ef4444' },
};

const ROL_CFG = {
  'Administrador': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'Admin':         { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'Usuario':       { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};

// ── Avatar ────────────────────────────────────────────────────────────────────
const Avatar = ({ url, nombre, size = 44 }) => {
  const inicial = nombre ? nombre.charAt(0).toUpperCase() : '?';
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {url
        ? <Image source={{ uri: url }} style={s.avatarImg} />
        : <Text style={[s.avatarInitials, { fontSize: size * 0.38 }]}>{inicial}</Text>
      }
    </View>
  );
};

// ── Chip de stats/filtro ──────────────────────────────────────────────────────
const StatChip = ({ label, val, color, activo, onPress }) => (
  <TouchableOpacity
    style={[s.statCard, activo && { borderColor: color }]}
    onPress={onPress}
  >
    <Text style={s.statLabel}>{label}</Text>
    <Text style={[s.statVal, { color }]}>{val}</Text>
  </TouchableOpacity>
);

export default function UsuariosView() {
  const [usuarios,     setUsuarios]     = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [busqueda,     setBusqueda]     = useState('');
  const [filtroEstado, setFiltroEstado] = useState(null);
  const [filtroRol,    setFiltroRol]    = useState(null);
  const [userDetalle,  setUserDetalle]  = useState(null);

  useEffect(() => { 
    // 1. Cargar datos iniciales
    fetchData(); 

    // 2. Configurar Realtime
    const canal = supabase
      .channel('perfiles-cambios')
      .on('postgres_changes', {
        event: 'UPDATE', 
        schema: 'public', 
        table: 'perfiles',
      }, (payload) => {
        // Actualizamos el estado local cuando alguien cambia en la DB
        setUsuarios(prev => prev.map(u =>
          u.id === payload.new.id 
            ? { ...u, ...payload.new } // Esto actualiza estado, avatar y cualquier otro campo nuevo
            : u
        ));

        // Si el usuario que se está viendo en el Modal es el que cambió, actualizarlo también
        setUserDetalle(current => 
          (current && current.id === payload.new.id) ? { ...current, ...payload.new } : current
        );
      })
      .subscribe();

    // 3. Limpieza: Importante en React Native para no agotar la batería/datos
    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getPerfiles();
      setUsuarios(data || []);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los colaboradores');
    } finally {
      setLoading(false);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:    usuarios.length,
    activos:  usuarios.filter(u => u.estado === 'Activo').length,
    inactivos:usuarios.filter(u => u.estado === 'Inactivo').length,
    admins:   usuarios.filter(u => u.rol === 'Administrador' || u.rol === 'Admin').length,
    usuarios: usuarios.filter(u => u.rol === 'Usuario').length,
  };

  // ── Filtrado ───────────────────────────────────────────────────────────────
  const usuariosFiltrados = usuarios.filter(u => {
    const term = busqueda.toLowerCase();
    const coincide = u.nombre?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
    const porEstado = filtroEstado ? u.estado === filtroEstado : true;
    const porRol    = filtroRol    ? (u.rol === filtroRol || (filtroRol === 'Administrador' && u.rol === 'Admin')) : true;
    return coincide && porEstado && porRol;
  });

  // ── Card de usuario ────────────────────────────────────────────────────────
  const renderUsuario = ({ item }) => {
    const eCfg = ESTADO_CFG[item.estado] || ESTADO_CFG['Inactivo'];
    const rCfg = ROL_CFG[item.rol] || ROL_CFG['Usuario'];
    return (
      <TouchableOpacity style={s.card} onPress={() => setUserDetalle(item)}>
        <View style={s.cardMain}>
          <Avatar url={item.avatar_url} nombre={item.nombre} />
          <View style={s.info}>
            <Text style={s.nombre}>{item.nombre || 'Sin nombre'}</Text>
            <Text style={s.email} numberOfLines={1}>{item.email}</Text>
          </View>
          <View style={[s.badge, { backgroundColor: rCfg.bg }]}>
            <Text style={[s.badgeText, { color: rCfg.color }]}>{item.rol}</Text>
          </View>
        </View>

        <View style={s.cardFooter}>
          <View style={s.statusRow}>
            <View style={[s.dot, { backgroundColor: eCfg.dot }]} />
            <Text style={[s.statusText, { color: eCfg.color }]}>
              {item.estado === 'Activo' ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
          {item.id_visual
            ? <Text style={s.idVisual}>#{item.id_visual}</Text>
            : null
          }
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>

      {/* Stats / filtros por estado ──────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.statsScroll}
        contentContainerStyle={s.statsContent}
      >
        <StatChip
          label="Total"    val={stats.total}    color="#3b82f6"
          activo={filtroEstado === null && filtroRol === null}
          onPress={() => { setFiltroEstado(null); setFiltroRol(null); }}
        />
        <StatChip
          label="Activos"  val={stats.activos}  color="#10b981"
          activo={filtroEstado === 'Activo'}
          onPress={() => setFiltroEstado(filtroEstado === 'Activo' ? null : 'Activo')}
        />
        <StatChip
          label="Inactivos" val={stats.inactivos} color="#ef4444"
          activo={filtroEstado === 'Inactivo'}
          onPress={() => setFiltroEstado(filtroEstado === 'Inactivo' ? null : 'Inactivo')}
        />
        <StatChip
          label="Admins"   val={stats.admins}   color="#8b5cf6"
          activo={filtroRol === 'Administrador'}
          onPress={() => setFiltroRol(filtroRol === 'Administrador' ? null : 'Administrador')}
        />
        <StatChip
          label="Usuarios" val={stats.usuarios} color="#64748b"
          activo={filtroRol === 'Usuario'}
          onPress={() => setFiltroRol(filtroRol === 'Usuario' ? null : 'Usuario')}
        />
      </ScrollView>

      {/* Buscador ───────────────────────────────────────────────────────────── */}
      <View style={s.header}>
        <TextInput
          style={s.search}
          placeholder="🔍 Buscar colaborador..."
          placeholderTextColor="#64748b"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {/* Lista ──────────────────────────────────────────────────────────────── */}
      
      {loading && usuarios.length === 0 ? ( // Solo si es la primera carga
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={s.emptyText}>Cargando colaboradores...</Text>
        </View>
      ) : usuariosFiltrados.length === 0 ? (
        <View style={s.centered}>
          <Text style={{ fontSize: 40 }}>👤</Text>
          <Text style={s.emptyText}>No se encontraron colaboradores.</Text>
        </View>
      ) : (
        <FlatList
          data={usuariosFiltrados}
          renderItem={renderUsuario}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          // Configuración del pull-to-refresh
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchData}
              tintColor="#3b82f6"
              colors={["#3b82f6"]}
              progressBackgroundColor="#0f1520"
            />
          }
        />
      )}

      {/* Modal detalle ──────────────────────────────────────────────────────── */}
      <Modal visible={!!userDetalle} animationType="slide" transparent>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            {userDetalle && (() => {
              const eCfg = ESTADO_CFG[userDetalle.estado] || ESTADO_CFG['Inactivo'];
              const rCfg = ROL_CFG[userDetalle.rol] || ROL_CFG['Usuario'];
              return (
                <>
                  <Avatar url={userDetalle.avatar_url} nombre={userDetalle.nombre} size={80} />

                  <Text style={s.modalTitle}>{userDetalle.nombre || 'Sin nombre'}</Text>
                  <Text style={s.modalSub}>{userDetalle.email}</Text>

                  <View style={s.modalBadgeRow}>
                    <View style={[s.badge, { backgroundColor: rCfg.bg }]}>
                      <Text style={[s.badgeText, { color: rCfg.color }]}>{userDetalle.rol}</Text>
                    </View>
                    <View style={[s.badge, { backgroundColor: eCfg.bg, flexDirection: 'row', gap: 5 }]}>
                      <View style={[s.dot, { backgroundColor: eCfg.dot }]} />
                      <Text style={[s.badgeText, { color: eCfg.color }]}>{userDetalle.estado}</Text>
                    </View>
                    {userDetalle.id_visual && (
                      <View style={s.badge}>
                        <Text style={[s.badgeText, { color: '#64748b', fontFamily: 'monospace' }]}>
                          #{userDetalle.id_visual}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={s.bioContainer}>
                    <Text style={s.bioTitle}>BIOGRAFÍA</Text>
                    <Text style={s.bioText}>
                      {userDetalle.biografia || 'Este colaborador no ha escrito su biografía aún.'}
                    </Text>
                  </View>

                  <TouchableOpacity style={s.btnClose} onPress={() => setUserDetalle(null)}>
                    <Text style={s.btnCloseText}>Cerrar</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06090f' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },

  statsScroll:  { flexGrow: 0, flexShrink: 0, marginBottom: 0 },
  statsContent: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, paddingRight: 20 },
  statCard: {
    backgroundColor: '#0f1520', borderRadius: 12, padding: 12,
    width: 90, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  statLabel: { color: '#64748b', fontSize: 10, marginBottom: 4 },
  statVal:   { fontSize: 20, fontWeight: '800' },

  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  search: {
    backgroundColor: '#0f1520', padding: 12, borderRadius: 10,
    color: '#e2e8f4', fontSize: 14, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },

  card: {
    backgroundColor: '#0f1520', padding: 16, borderRadius: 14,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  cardMain:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  info:       { flex: 1, marginLeft: 12 },
  nombre:     { color: '#e2e8f4', fontSize: 14, fontWeight: '700' },
  email:      { color: '#64748b', fontSize: 12, marginTop: 2 },
  badge:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, flexDirection: 'row', alignItems: 'center' },
  badgeText:  { fontSize: 10, fontWeight: '700' },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10 },
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 11, fontWeight: '600' },
  idVisual:   { color: '#475569', fontSize: 11, fontFamily: 'monospace' },
  emptyText:  { color: '#64748b', fontSize: 13 },

  avatar:         { backgroundColor: '#1e3a5f', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg:      { width: '100%', height: '100%' },
  avatarInitials: { color: '#60a5fa', fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: {
    backgroundColor: '#0f1520', borderRadius: 22, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle:    { color: '#e2e8f4', fontSize: 19, fontWeight: '700', marginTop: 14 },
  modalSub:      { color: '#3b82f6', fontSize: 13, marginBottom: 14 },
  modalBadgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 20 },
  bioContainer:  { alignSelf: 'stretch', backgroundColor: '#151d2e', padding: 16, borderRadius: 12, marginBottom: 20 },
  bioTitle:      { color: '#64748b', fontSize: 9, marginBottom: 8, fontWeight: '700', letterSpacing: 1.2, fontFamily: 'monospace' },
  bioText:       { color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  btnClose:      { backgroundColor: '#151d2e', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  btnCloseText:  { color: '#94a3b8', fontWeight: '600', fontSize: 13 },
});