// screens/admin/UsuariosView.js
// Incluye bloqueo de promoción a Admin cuando el usuario tiene tareas activas.
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image,
  TextInput, ActivityIndicator, Alert, Modal, ScrollView, RefreshControl,
} from 'react-native';
import { getPerfiles, getTodasTareas, actualizarPerfil } from '../../services/api';
import { validar, esValido, REGLAS } from '../../hooks/useValidacion';
import { supabase } from '../../services/auth';

// ── Configs ───────────────────────────────────────────────────────────────────
const ESTADO_CFG = {
  'Activo':   { color: '#10b981', bg: 'rgba(16,185,129,0.12)', dot: '#10b981' },
  'Inactivo': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  dot: '#ef4444' },
};

const ROL_CFG = {
  'Administrador': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'Admin':         { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'Usuario':       { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};

// Estados que se consideran "activos" (bloquean la promoción)
const ESTADOS_ACTIVOS = ['Pendiente', 'En Progreso', 'En Revisión'];

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const StatChip = ({ label, val, color, activo, onPress }) => (
  <TouchableOpacity style={[s.statCard, activo && { borderColor: color }]} onPress={onPress}>
    <Text style={s.statLabel}>{label}</Text>
    <Text style={[s.statVal, { color }]}>{val}</Text>
  </TouchableOpacity>
);

// ── Esquema de validación del formulario ──────────────────────────────────────
const ESQUEMA_FORM = {
  nombre: [REGLAS.requerido, REGLAS.minLength(2), REGLAS.maxLength(80)],
  email:  [REGLAS.requerido, REGLAS.email],
};

// ── Modal Formulario de edición ───────────────────────────────────────────────
const ModalForm = ({ visible, editando, datos, onChange, onGuardar, onCerrar, enviando, errores, onLimpiarError, tareasActivas }) => {
  // Detectar si el formulario intenta promover a admin
  const intentaPromoverAAdmin =
    editando &&
    datos.rol_original === 'Usuario' &&
    (datos.rol === 'Administrador' || datos.rol === 'Admin');

  const bloqueado = intentaPromoverAAdmin && tareasActivas > 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={s.modalOverlay}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>{editando ? '✏️ Editar Colaborador' : '👤 Nuevo Colaborador'}</Text>
            <TouchableOpacity onPress={onCerrar} style={s.cerrarBtn}>
              <Text style={s.cerrarBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Nombre */}
            <View style={s.formField}>
              <Text style={s.formLabel}>Nombre completo <Text style={s.required}>*</Text></Text>
              <TextInput
                style={[s.input, errores.nombre && s.inputError]}
                placeholder="Nombre completo"
                placeholderTextColor="#475569"
                value={datos.nombre}
                onChangeText={v => { onChange({ ...datos, nombre: v }); onLimpiarError('nombre'); }}
              />
              {errores.nombre ? <Text style={s.errorMsg}>{errores.nombre}</Text> : null}
            </View>

            {/* Email */}
            <View style={s.formField}>
              <Text style={s.formLabel}>Correo <Text style={s.required}>*</Text></Text>
              <TextInput
                style={[s.input, errores.email && s.inputError]}
                placeholder="correo@empresa.com"
                placeholderTextColor="#475569"
                value={datos.email}
                onChangeText={v => { onChange({ ...datos, email: v }); onLimpiarError('email'); }}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              {errores.email ? <Text style={s.errorMsg}>{errores.email}</Text> : null}
            </View>

            {/* Biografía */}
            <View style={s.formField}>
              <Text style={s.formLabel}>Biografía <Text style={s.optional}>(opcional)</Text></Text>
              <TextInput
                style={[s.input, { height: 90, textAlignVertical: 'top' }]}
                placeholder="Habilidades, notas..."
                placeholderTextColor="#475569"
                value={datos.biografia}
                onChangeText={v => onChange({ ...datos, biografia: v })}
                multiline
              />
            </View>

            {/* Rol */}
            <View style={s.formField}>
              <Text style={s.formLabel}>Rol</Text>
              <View style={s.chipWrap}>
                {['Usuario', 'Administrador'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      s.chipSelector,
                      datos.rol === r && s.chipSelectorActive,
                      // Resaltar en rojo si se intenta hacer admin con tareas activas
                      r === 'Administrador' && datos.rol === 'Administrador' && bloqueado && s.chipSelectorError,
                    ]}
                    onPress={() => onChange({ ...datos, rol: r })}
                  >
                    <Text style={[
                      s.chipSelectorText,
                      datos.rol === r && { color: '#3b82f6' },
                      r === 'Administrador' && datos.rol === 'Administrador' && bloqueado && { color: '#ef4444' },
                    ]}>
                      {r === 'Administrador' ? '👑 Administrador' : '👤 Usuario'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* ── Advertencia de bloqueo por tareas activas ── */}
              {bloqueado && (
                <View style={s.alertaBloqueo}>
                  <Text style={s.alertaBloqueoIcon}>⚠️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={s.alertaBloqueoTitulo}>
                      No se puede promover a Administrador
                    </Text>
                    <Text style={s.alertaBloqueoTexto}>
                      Este colaborador tiene {tareasActivas} tarea{tareasActivas !== 1 ? 's' : ''} activa{tareasActivas !== 1 ? 's' : ''} asignada{tareasActivas !== 1 ? 's' : ''}.
                      Reasigna o completa las tareas antes de cambiar el rol.
                    </Text>
                  </View>
                </View>
              )}

              {/* Aviso informativo si se intenta promover SIN tareas (todo OK) */}
              {intentaPromoverAAdmin && !bloqueado && (
                <View style={s.alertaInfo}>
                  <Text style={s.alertaInfoTexto}>
                    ℹ️ Este colaborador no tiene tareas activas. La promoción puede realizarse.
                  </Text>
                </View>
              )}
            </View>

            {/* Estado */}
            <View style={s.formField}>
              <Text style={s.formLabel}>Estado</Text>
              <View style={s.chipWrap}>
                {['Activo', 'Inactivo'].map(e => {
                  const cfg = ESTADO_CFG[e];
                  return (
                    <TouchableOpacity
                      key={e}
                      style={[s.chipSelector, datos.estado === e && { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                      onPress={() => onChange({ ...datos, estado: e })}
                    >
                      <Text style={[s.chipSelectorText, datos.estado === e && { color: cfg.color }]}>{e}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Botones */}
            <TouchableOpacity
              style={[s.btnPrimario, (enviando || bloqueado) && { opacity: 0.5 }]}
              onPress={onGuardar}
              disabled={enviando || bloqueado}
            >
              {enviando
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnPrimarioText}>{editando ? 'Actualizar' : 'Crear Colaborador'}</Text>
              }
            </TouchableOpacity>
            {bloqueado && (
              <Text style={s.btnBloqueadoHint}>
                Resuelve las tareas activas para habilitar el botón
              </Text>
            )}

            <TouchableOpacity style={[s.btnSecundario, { marginTop: 8 }]} onPress={onCerrar}>
              <Text style={s.btnSecundarioText}>Cancelar</Text>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── Vista Principal ───────────────────────────────────────────────────────────
export default function UsuariosView() {
  const [usuarios,     setUsuarios]     = useState([]);
  const [todasTareas,  setTodasTareas]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [busqueda,     setBusqueda]     = useState('');
  const [filtroEstado, setFiltroEstado] = useState(null);
  const [filtroRol,    setFiltroRol]    = useState(null);
  const [userDetalle,  setUserDetalle]  = useState(null);
  const [mostrarForm,  setMostrarForm]  = useState(false);
  const [editandoId,   setEditandoId]   = useState(null);
  const [enviando,     setEnviando]     = useState(false);
  const [errores,      setErrores]      = useState({});
  const [formData, setFormData] = useState({
    nombre: '', email: '', biografia: '', rol: 'Usuario',
    estado: 'Activo', rol_original: 'Usuario',
  });

  // ── Carga inicial ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchData();

    // Realtime: actualizar estado/avatar cuando cambia en DB
    const canal = supabase
      .channel('perfiles-cambios')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'perfiles' }, (payload) => {
        setUsuarios(prev => prev.map(u => u.id === payload.new.id ? { ...u, ...payload.new } : u));
        setUserDetalle(cur => cur?.id === payload.new.id ? { ...cur, ...payload.new } : cur);
      })
      .subscribe();

    return () => supabase.removeChannel(canal);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [perfs, tareas] = await Promise.all([getPerfiles(), getTodasTareas()]);
      setUsuarios(perfs || []);
      setTodasTareas(tareas || []);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los colaboradores');
    } finally {
      setLoading(false);
    }
  };

  // ── Tareas activas de un usuario ───────────────────────────────────────────
  const tareasActivasDeUsuario = (userId) =>
    todasTareas.filter(
      t => t.empleado_id === userId && ESTADOS_ACTIVOS.includes(t.estado)
    ).length;

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:     usuarios.length,
    activos:   usuarios.filter(u => u.estado === 'Activo').length,
    inactivos: usuarios.filter(u => u.estado === 'Inactivo').length,
    admins:    usuarios.filter(u => u.rol === 'Administrador' || u.rol === 'Admin').length,
    usuarios:  usuarios.filter(u => u.rol === 'Usuario').length,
  };

  // ── Filtrado ───────────────────────────────────────────────────────────────
  const filtrados = usuarios.filter(u => {
    const term    = busqueda.toLowerCase();
    const coincide = u.nombre?.toLowerCase().includes(term) || u.email?.toLowerCase().includes(term);
    const porEstado = filtroEstado ? u.estado === filtroEstado : true;
    const porRol    = filtroRol
      ? (u.rol === filtroRol || (filtroRol === 'Administrador' && u.rol === 'Admin'))
      : true;
    return coincide && porEstado && porRol;
  });

  // ── Formulario ─────────────────────────────────────────────────────────────
  const abrirForm = (u = null) => {
    setErrores({});
    if (u) {
      setFormData({
        nombre: u.nombre || '', email: u.email || '',
        biografia: u.biografia || '', rol: u.rol || 'Usuario',
        estado: u.estado || 'Activo',
        rol_original: u.rol || 'Usuario',  // guardar el rol actual para detectar promoción
      });
      setEditandoId(u.id);
    } else {
      setFormData({ nombre: '', email: '', biografia: '', rol: 'Usuario', estado: 'Activo', rol_original: 'Usuario' });
      setEditandoId(null);
    }
    setMostrarForm(true);
  };

  const limpiarError = (campo) =>
    setErrores(prev => { const n = { ...prev }; delete n[campo]; return n; });

  const handleGuardar = async () => {
    // 1. Validación de campos
    const errs = validar(formData, ESQUEMA_FORM);
    setErrores(errs);
    if (!esValido(errs)) return;

    // 2. Bloqueo de promoción a Admin con tareas activas
    const intentaPromover =
      editandoId &&
      formData.rol_original === 'Usuario' &&
      (formData.rol === 'Administrador' || formData.rol === 'Admin');

    if (intentaPromover) {
      const activas = tareasActivasDeUsuario(editandoId);
      if (activas > 0) {
        // No deberíamos llegar aquí porque el botón está deshabilitado,
        // pero lo dejamos como salvaguarda extra
        Alert.alert(
          'Promoción bloqueada',
          `Este colaborador tiene ${activas} tarea${activas !== 1 ? 's' : ''} activa${activas !== 1 ? 's' : ''}. Reasígnalas antes de cambiar el rol.`
        );
        return;
      }
    }

    setEnviando(true);
    try {
      const { rol_original, ...datosSinMeta } = formData;
      await actualizarPerfil(editandoId, datosSinMeta);
      setMostrarForm(false);
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo guardar el colaborador');
    } finally {
      setEnviando(false);
    }
  };

  // ── Card de usuario ────────────────────────────────────────────────────────
  const renderUsuario = ({ item }) => {
    const eCfg = ESTADO_CFG[item.estado] || ESTADO_CFG['Inactivo'];
    const rCfg = ROL_CFG[item.rol] || ROL_CFG['Usuario'];
    const activas = tareasActivasDeUsuario(item.id);

    return (
      <TouchableOpacity style={s.card} onPress={() => setUserDetalle(item)}>
        <View style={s.cardMain}>
          <Avatar url={item.avatar_url} nombre={item.nombre} />
          <View style={s.info}>
            <Text style={s.nombre}>{item.nombre || 'Sin nombre'}</Text>
            <Text style={s.email} numberOfLines={1}>{item.email}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={[s.badge, { backgroundColor: rCfg.bg }]}>
              <Text style={[s.badgeText, { color: rCfg.color }]}>{item.rol}</Text>
            </View>
            {/* Indicador de tareas activas */}
            {activas > 0 && item.rol === 'Usuario' && (
              <View style={s.tareasActivasBadge}>
                <Text style={s.tareasActivasText}>{activas} tarea{activas !== 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={s.cardFooter}>
          <View style={s.statusRow}>
            <View style={[s.dot, { backgroundColor: eCfg.dot }]} />
            <Text style={[s.statusText, { color: eCfg.color }]}>
              {item.estado === 'Activo' ? 'Activo' : 'Inactivo'}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {item.id_visual ? <Text style={s.idVisual}>#{item.id_visual}</Text> : null}
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => abrirForm(item)}
            >
              <Text style={s.editBtnText}>✏️ Editar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // ── Modal detalle ──────────────────────────────────────────────────────────
  const renderDetalle = () => {
    if (!userDetalle) return null;
    const eCfg   = ESTADO_CFG[userDetalle.estado] || ESTADO_CFG['Inactivo'];
    const rCfg   = ROL_CFG[userDetalle.rol] || ROL_CFG['Usuario'];
    const activas = tareasActivasDeUsuario(userDetalle.id);
    const tareasUsuario = todasTareas.filter(t => t.empleado_id === userDetalle.id);

    return (
      <Modal visible animationType="slide" transparent onRequestClose={() => setUserDetalle(null)}>
        <View style={s.modalOverlay}>
          <View style={[s.modalContainer, { maxHeight: '85%' }]}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>Perfil del colaborador</Text>
              <TouchableOpacity onPress={() => setUserDetalle(null)} style={s.cerrarBtn}>
                <Text style={s.cerrarBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Hero */}
              <View style={s.detalleHero}>
                <Avatar url={userDetalle.avatar_url} nombre={userDetalle.nombre} size={72} />
                <Text style={s.detalleNombre}>{userDetalle.nombre || 'Sin nombre'}</Text>
                <Text style={s.detalleEmail}>{userDetalle.email}</Text>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                  <View style={[s.badge, { backgroundColor: rCfg.bg }]}>
                    <Text style={[s.badgeText, { color: rCfg.color }]}>{userDetalle.rol}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: eCfg.bg, flexDirection: 'row', gap: 5, alignItems: 'center' }]}>
                    <View style={[s.dot, { backgroundColor: eCfg.dot }]} />
                    <Text style={[s.badgeText, { color: eCfg.color }]}>{userDetalle.estado}</Text>
                  </View>
                  {userDetalle.id_visual ? (
                    <View style={[s.badge, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
                      <Text style={[s.badgeText, { color: '#64748b', fontFamily: 'monospace' }]}>
                        #{userDetalle.id_visual}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {/* Stats de tareas */}
              <View style={s.qiGrid}>
                <View style={s.qiItem}>
                  <Text style={s.qiLabel}>Total tareas</Text>
                  <Text style={[s.qiVal, { color: '#3b82f6' }]}>{tareasUsuario.length}</Text>
                </View>
                <View style={s.qiItem}>
                  <Text style={s.qiLabel}>En progreso</Text>
                  <Text style={[s.qiVal, { color: '#3b82f6' }]}>
                    {tareasUsuario.filter(t => t.estado === 'En Progreso').length}
                  </Text>
                </View>
                <View style={s.qiItem}>
                  <Text style={s.qiLabel}>Completadas</Text>
                  <Text style={[s.qiVal, { color: '#10b981' }]}>
                    {tareasUsuario.filter(t => t.estado === 'Completada').length}
                  </Text>
                </View>
                <View style={s.qiItem}>
                  <Text style={s.qiLabel}>Avance prom.</Text>
                  <Text style={[s.qiVal, { color: '#f59e0b' }]}>
                    {tareasUsuario.length
                      ? Math.round(tareasUsuario.reduce((a, t) => a + (t.avance || 0), 0) / tareasUsuario.length)
                      : 0}%
                  </Text>
                </View>
              </View>

              {/* Aviso de tareas activas (visible en el detalle también) */}
              {activas > 0 && userDetalle.rol === 'Usuario' && (
                <View style={[s.alertaBloqueo, { marginBottom: 16 }]}>
                  <Text style={s.alertaBloqueoIcon}>📋</Text>
                  <Text style={[s.alertaBloqueoTexto, { flex: 1 }]}>
                    Tiene {activas} tarea{activas !== 1 ? 's' : ''} activa{activas !== 1 ? 's' : ''}.
                    Deben reasignarse antes de promover a Administrador.
                  </Text>
                </View>
              )}

              {/* Biografía */}
              <View style={s.bioBox}>
                <Text style={s.bioTitle}>BIOGRAFÍA</Text>
                <Text style={s.bioText}>
                  {userDetalle.biografia || 'Este colaborador no ha escrito su biografía aún.'}
                </Text>
              </View>

              {/* Lista de tareas */}
              {tareasUsuario.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={[s.bioTitle, { marginBottom: 10 }]}>TAREAS ASIGNADAS</Text>
                  {tareasUsuario.map(t => {
                    const TAREA_DOT = {
                      'Pendiente':   '#94a3b8',
                      'En Progreso': '#3b82f6',
                      'En Revisión': '#f59e0b',
                      'Completada':  '#10b981',
                    };
                    return (
                      <View key={t.id} style={s.tareaItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.tareaTitulo} numberOfLines={1}>{t.titulo}</Text>
                          <Text style={s.tareaProyecto}>
                            📁 {t.proyectos?.nombre_proyecto || '—'}
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 4 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <View style={[s.dot, { backgroundColor: TAREA_DOT[t.estado] || '#94a3b8' }]} />
                            <Text style={[s.badgeText, { color: TAREA_DOT[t.estado] || '#94a3b8' }]}>
                              {t.estado}
                            </Text>
                          </View>
                          <Text style={s.tareaAvance}>{t.avance || 0}%</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}

              <TouchableOpacity
                style={s.btnPrimario}
                onPress={() => { setUserDetalle(null); abrirForm(userDetalle); }}
              >
                <Text style={s.btnPrimarioText}>✏️ Editar colaborador</Text>
              </TouchableOpacity>
              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={s.container}>

      {/* Stats / filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={s.statsScroll} contentContainerStyle={s.statsContent}>
        <StatChip label="Total"    val={stats.total}     color="#3b82f6"
          activo={!filtroEstado && !filtroRol}
          onPress={() => { setFiltroEstado(null); setFiltroRol(null); }} />
        <StatChip label="Activos"  val={stats.activos}   color="#10b981"
          activo={filtroEstado === 'Activo'}
          onPress={() => setFiltroEstado(filtroEstado === 'Activo' ? null : 'Activo')} />
        <StatChip label="Inactivos" val={stats.inactivos} color="#ef4444"
          activo={filtroEstado === 'Inactivo'}
          onPress={() => setFiltroEstado(filtroEstado === 'Inactivo' ? null : 'Inactivo')} />
        <StatChip label="Admins"   val={stats.admins}    color="#8b5cf6"
          activo={filtroRol === 'Administrador'}
          onPress={() => setFiltroRol(filtroRol === 'Administrador' ? null : 'Administrador')} />
        <StatChip label="Usuarios" val={stats.usuarios}  color="#64748b"
          activo={filtroRol === 'Usuario'}
          onPress={() => setFiltroRol(filtroRol === 'Usuario' ? null : 'Usuario')} />
      </ScrollView>

      {/* Buscador */}
      <View style={s.header}>
        <TextInput
          style={s.search}
          placeholder="🔍 Buscar colaborador..."
          placeholderTextColor="#64748b"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {/* Lista */}
      {loading && usuarios.length === 0 ? (
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={s.emptyText}>Cargando colaboradores...</Text>
        </View>
      ) : filtrados.length === 0 ? (
        <View style={s.centered}>
          <Text style={{ fontSize: 40 }}>👤</Text>
          <Text style={s.emptyText}>No se encontraron colaboradores.</Text>
        </View>
      ) : (
        <FlatList
          data={filtrados}
          renderItem={renderUsuario}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchData}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
              progressBackgroundColor="#0f1520"
            />
          }
        />
      )}

      {/* Modal detalle */}
      {renderDetalle()}

      {/* Modal formulario */}
      <ModalForm
        visible={mostrarForm}
        editando={!!editandoId}
        datos={formData}
        onChange={setFormData}
        onGuardar={handleGuardar}
        onCerrar={() => setMostrarForm(false)}
        enviando={enviando}
        errores={errores}
        onLimpiarError={limpiarError}
        tareasActivas={editandoId ? tareasActivasDeUsuario(editandoId) : 0}
      />
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06090f' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },

  statsScroll:  { flexGrow: 0, flexShrink: 0 },
  statsContent: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingVertical: 12, paddingRight: 20 },
  statCard:     { backgroundColor: '#0f1520', borderRadius: 12, padding: 12, width: 90, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  statLabel:    { color: '#64748b', fontSize: 10, marginBottom: 4 },
  statVal:      { fontSize: 20, fontWeight: '800' },

  header: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  search: { backgroundColor: '#0f1520', padding: 12, borderRadius: 10, color: '#e2e8f4', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },

  card:       { backgroundColor: '#0f1520', padding: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  cardMain:   { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  info:       { flex: 1, minWidth: 0 },
  nombre:     { color: '#e2e8f4', fontSize: 14, fontWeight: '700' },
  email:      { color: '#64748b', fontSize: 12, marginTop: 2 },
  badge:      { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText:  { fontSize: 10, fontWeight: '700' },
  dot:        { width: 6, height: 6, borderRadius: 3 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 10 },
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 11, fontWeight: '600' },
  idVisual:   { color: '#475569', fontSize: 11, fontFamily: 'monospace' },
  emptyText:  { color: '#64748b', fontSize: 13 },

  tareasActivasBadge: { backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  tareasActivasText:  { color: '#f59e0b', fontSize: 9, fontWeight: '700', fontFamily: 'monospace' },

  editBtn:     { backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' },
  editBtnText: { color: '#3b82f6', fontSize: 11, fontWeight: '600' },

  avatar:         { backgroundColor: '#1e3a5f', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg:      { width: '100%', height: '100%' },
  avatarInitials: { color: '#60a5fa', fontWeight: '700' },

  // Modal compartido
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#0f1520', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitulo:    { color: '#e2e8f4', fontSize: 17, fontWeight: '800' },
  cerrarBtn:      { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  cerrarBtnText:  { color: '#64748b', fontSize: 14 },

  // Detalle
  detalleHero:   { alignItems: 'center', marginBottom: 20, gap: 6 },
  detalleNombre: { color: '#e2e8f4', fontSize: 18, fontWeight: '800', marginTop: 8 },
  detalleEmail:  { color: '#64748b', fontSize: 13 },
  qiGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  qiItem:        { backgroundColor: '#151d2e', borderRadius: 10, padding: 12, flex: 1, minWidth: '40%' },
  qiLabel:       { color: '#64748b', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: 'monospace', marginBottom: 4 },
  qiVal:         { fontSize: 18, fontWeight: '800' },
  bioBox:        { backgroundColor: '#151d2e', borderRadius: 12, padding: 16, marginBottom: 16 },
  bioTitle:      { color: '#3a4558', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'monospace', marginBottom: 8 },
  bioText:       { color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  tareaItem:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#151d2e', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  tareaTitulo:   { color: '#e2e8f4', fontSize: 13, fontWeight: '600' },
  tareaProyecto: { color: '#64748b', fontSize: 11, marginTop: 2 },
  tareaAvance:   { color: '#64748b', fontSize: 11, fontFamily: 'monospace' },

  // Formulario
  formField:  { marginBottom: 16 },
  formLabel:  { color: '#e2e8f4', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  required:   { color: '#ef4444' },
  optional:   { color: '#64748b', fontWeight: '400', fontSize: 11 },
  input:      { backgroundColor: '#151d2e', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, color: '#e2e8f4', fontSize: 14 },
  inputError: { borderColor: 'rgba(239,68,68,0.5)' },
  errorMsg:   { fontSize: 11.5, color: '#ef4444', fontFamily: 'monospace', marginTop: 4 },
  chipWrap:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chipSelector: {
    backgroundColor: '#151d2e', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, alignSelf: 'flex-start',
  },
  chipSelectorActive: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)' },
  chipSelectorError:  { borderColor: 'rgba(239,68,68,0.5)', backgroundColor: 'rgba(239,68,68,0.08)' },
  chipSelectorText:   { color: '#64748b', fontSize: 13 },

  // Alertas
  alertaBloqueo: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)',
    borderRadius: 12, padding: 14, marginTop: 10,
  },
  alertaBloqueoIcon:   { fontSize: 18 },
  alertaBloqueoTitulo: { color: '#ef4444', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  alertaBloqueoTexto:  { color: '#fca5a5', fontSize: 12, lineHeight: 18 },
  alertaInfo: {
    backgroundColor: 'rgba(59,130,246,0.08)',
    borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)',
    borderRadius: 10, padding: 12, marginTop: 8,
  },
  alertaInfoTexto: { color: '#93c5fd', fontSize: 12, lineHeight: 18 },

  btnBloqueadoHint: { color: '#ef4444', fontSize: 11.5, textAlign: 'center', marginTop: 6, fontFamily: 'monospace' },
  btnPrimario:      { backgroundColor: '#3b82f6', borderRadius: 12, padding: 14, alignItems: 'center', marginTop: 8 },
  btnPrimarioText:  { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecundario:    { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  btnSecundarioText:{ color: '#64748b', fontWeight: '600' },
});