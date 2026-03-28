// screens/admin/TareasView.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Linking, RefreshControl,
} from 'react-native';
import {
  getTodasTareas, getProyectos, getUsuarios,
  crearTarea, actualizarTareaAdmin, eliminarTarea, getExtras
} from '../../services/api';
import DateTimePicker from '@react-native-community/datetimepicker';

// ── Configs ───────────────────────────────────────────────────────────────────
const PRIORIDAD_CFG = {
  'Urgente': { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: '🔴' },
  'Alta':    { color: '#f97316', bg: 'rgba(249,115,22,0.15)',  icon: '🟠' },
  'Media':   { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '🟡' },
  'Baja':    { color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '🟢' },
};

const ESTADO_CFG = {
  'Pendiente':   { color: '#64748b', bg: 'rgba(100,116,139,0.15)', dot: '#94a3b8' },
  'En Progreso': { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  dot: '#3b82f6' },
  'En Revisión': { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  dot: '#f59e0b' },
  'Completada':  { color: '#10b981', bg: 'rgba(16,185,129,0.15)',  dot: '#10b981' },
};

const formatFecha = (f) => {
  if (!f) return '—';
  return new Date(f).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Modal Detalle ─────────────────────────────────────────────────────────────
const ModalDetalle = ({ tarea, visible, onCerrar, onEditar, onEliminar, onActualizar }) => {
  const [tab, setTab] = useState('info');
  const [comentarios, setComentarios] = useState([]);
  const [links, setLinks] = useState([]);
  const [cargandoExtras, setCargandoExtras] = useState(false);

  useEffect(() => {
    if (visible && tarea && (tab === 'notas' || tab === 'links')) {
      cargarExtras();
    }
  }, [visible, tab, tarea?.id]);

  const cargarExtras = async () => {
    if (!tarea) return;
    setCargandoExtras(true);
    try {
      const data = await getExtras(tarea.id);
      setComentarios(data.filter(e => e.tipo === 'comentario'));
      setLinks(data.filter(e => e.tipo === 'link'));
    } catch (err) {
      console.error('Error cargando extras:', err);
    } finally {
      setCargandoExtras(false);
    }
  };

  if (!tarea) return null;
  const pCfg = PRIORIDAD_CFG[tarea.prioridad] || PRIORIDAD_CFG['Baja'];
  const eCfg = ESTADO_CFG[tarea.estado] || ESTADO_CFG['Pendiente'];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={s.modalOverlay}>
        <View style={s.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>

            {/* Header */}
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <Text style={s.codigoSerie}>{tarea.codigo_serie}</Text>
                  <View style={[s.badge, { backgroundColor: pCfg.bg }]}>
                    <Text style={[s.badgeText, { color: pCfg.color }]}>{pCfg.icon} {tarea.prioridad}</Text>
                  </View>
                  <View style={[s.badge, { backgroundColor: eCfg.bg }]}>
                    <View style={[s.dot, { backgroundColor: eCfg.dot }]} />
                    <Text style={[s.badgeText, { color: eCfg.color }]}>{tarea.estado}</Text>
                  </View>
                </View>
                <Text style={s.modalTitulo}>{tarea.titulo}</Text>
              </View>
              <TouchableOpacity onPress={onCerrar}>
                <Text style={s.cerrarBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Acciones */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TouchableOpacity style={s.btnSecundario} onPress={() => { onCerrar(); onEditar(tarea); }}>
                <Text style={s.btnSecundarioText}>✏️ Editar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnDanger} onPress={() => onEliminar(tarea.id)}>
                <Text style={s.btnDangerText}>🗑️ Eliminar</Text>
              </TouchableOpacity>
            </View>

            {/* Quickinfo */}
            <View style={s.quickinfo}>
              {[
                { label: 'Proyecto',    val: tarea.proyectos?.nombre_proyecto || '—' },
                { label: 'Cliente',     val: tarea.proyectos?.clientes?.empresa || '—' },
                { label: 'Responsable', val: tarea.perfiles?.nombre || '—' },
                { label: 'Avance',      val: `${tarea.avance || 0}%`, color: '#10b981' },
              ].map(item => (
                <View key={item.label} style={s.qiItem}>
                  <Text style={s.qiLabel}>{item.label}</Text>
                  <Text style={[s.qiVal, item.color ? { color: item.color } : {}]}>{item.val}</Text>
                </View>
              ))}
            </View>

            {/* Barra de progreso */}
            <View style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={s.subText}>Avance de la tarea</Text>
                <Text style={s.subText}>{tarea.avance || 0}%</Text>
              </View>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${tarea.avance || 0}%`, backgroundColor: eCfg.dot }]} />
              </View>
            </View>

            {/* Fechas */}
            <View style={[s.quickinfo, { marginBottom: 16 }]}>
              <View style={s.qiItem}>
                <Text style={s.qiLabel}>Fecha Inicio</Text>
                <Text style={s.qiVal}>{formatFecha(tarea.fecha_inicio)}</Text>
              </View>
              <View style={s.qiItem}>
                <Text style={s.qiLabel}>Fecha Límite</Text>
                <Text style={s.qiVal}>{formatFecha(tarea.fecha_finalizacion)}</Text>
              </View>
              {tarea.fecha_completada && (
                <View style={s.qiItem}>
                  <Text style={s.qiLabel}>Completada el</Text>
                  <Text style={[s.qiVal, { color: '#10b981' }]}>✓ {formatFecha(tarea.fecha_completada)}</Text>
                </View>
              )}
            </View>

            {/* Cambiar estado */}
            <Text style={s.panelTitle}>Cambiar estado</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={s.chipRow}>
                {Object.entries(ESTADO_CFG).map(([estado, cfg]) => {
                  const activo = tarea.estado === estado;
                  return (
                    <TouchableOpacity
                      key={estado}
                      style={[s.chipEstado, activo && { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                      onPress={() => onActualizar(tarea.id, { estado })}
                    >
                      <View style={[s.dot, { backgroundColor: cfg.dot }]} />
                      <Text style={[s.chipEstadoText, activo && { color: cfg.color }]}>{estado}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={s.chipRow}>
                {[
                  { key: 'info',  label: '📋 Instrucciones' },
                  { key: 'notas', label: `💬 Notas${comentarios.length > 0 ? ` (${comentarios.length})` : ''}` },
                  { key: 'links', label: `🔗 Links${links.length > 0 ? ` (${links.length})` : ''}` },
                ].map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[s.tab, tab === t.key && s.tabActivo]}
                    onPress={() => setTab(t.key)}
                  >
                    <Text style={[s.tabText, tab === t.key && s.tabTextActivo]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Tab: Instrucciones */}
            {tab === 'info' && (
              tarea.instrucciones ? (
                <View style={s.instruccionesBox}>
                  <Text style={s.instruccionesText}>{tarea.instrucciones}</Text>
                </View>
              ) : (
                <View style={s.emptyState}>
                  <Text style={s.emptyText}>Sin instrucciones registradas.</Text>
                </View>
              )
            )}

            {/* Tab: Notas */}
            {tab === 'notas' && (
              cargandoExtras ? (
                <ActivityIndicator color="#3b82f6" style={{ marginTop: 20 }} />
              ) : comentarios.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyText}>El colaborador no ha agregado notas aún.</Text>
                </View>
              ) : (
                comentarios.map(c => (
                  <View key={c.id} style={s.extraItem}>
                    <Text style={s.extraContenido}>{c.contenido}</Text>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={s.extraMeta}>👤 {c.perfiles?.nombre || 'Usuario'}</Text>
                      <Text style={s.extraMeta}>
                        {new Date(c.creado_en).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                ))
              )
            )}

            {/* Tab: Links */}
            {tab === 'links' && (
              cargandoExtras ? (
                <ActivityIndicator color="#3b82f6" style={{ marginTop: 20 }} />
              ) : links.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyText}>El colaborador no ha adjuntado enlaces aún.</Text>
                </View>
              ) : (
                links.map(l => (
                  <TouchableOpacity
                    key={l.id}
                    style={s.linkItem}
                    onPress={() => Linking.openURL(l.contenido)}
                  >
                    <Text style={{ fontSize: 20 }}>🔗</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.linkNombre} numberOfLines={1}>{l.nombre || l.contenido}</Text>
                      <Text style={s.extraMeta}>
                        👤 {l.perfiles?.nombre || 'Usuario'} · {formatFecha(l.creado_en)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              )
            )}

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── Modal Formulario ──────────────────────────────────────────────────────────
const ModalForm = ({ visible, editando, datos, onChange, onGuardar, onCerrar, enviando, proyectos, usuarios }) => {
  const [showPicker, setShowPicker] = useState(false);
  const prioridades = ['Baja', 'Media', 'Alta', 'Urgente'];
  const estados     = ['Pendiente', 'En Progreso', 'En Revisión', 'Completada'];

  const onDateChange = (event, selectedDate) => {
    setShowPicker(false); 
    if (selectedDate) {
      
      onChange({ ...datos, fecha_finalizacion: selectedDate.toISOString() });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={s.modalOverlay}>
        <View style={s.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false}>

            <View style={s.modalHeader}>
              <Text style={s.modalTitulo}>{editando ? '✏️ Editar Tarea' : '➕ Nueva Tarea'}</Text>
              <TouchableOpacity onPress={onCerrar}>
                <Text style={s.cerrarBtn}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Proyecto */}
            <Text style={s.formLabel}>Proyecto *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={s.chipRow}>
                {proyectos.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.chipSelector, datos.proyecto_id === p.id && s.chipSelectorActive]}
                    onPress={() => onChange({ ...datos, proyecto_id: p.id })}
                  >
                    <Text style={[s.chipSelectorText, datos.proyecto_id === p.id && { color: '#3b82f6' }]}>
                      {p.nombre_proyecto}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Responsable */}
            <Text style={s.formLabel}>Responsable *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={s.chipRow}>
                {usuarios.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={[s.chipSelector, datos.empleado_id === u.id && s.chipSelectorActive]}
                    onPress={() => onChange({ ...datos, empleado_id: u.id })}
                  >
                    <Text style={[s.chipSelectorText, datos.empleado_id === u.id && { color: '#3b82f6' }]}>
                      {u.nombre}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Título */}
            <Text style={s.formLabel}>Título *</Text>
            <TextInput
              style={s.input}
              placeholder="Título de la tarea"
              placeholderTextColor="#475569"
              value={datos.titulo}
              onChangeText={v => onChange({ ...datos, titulo: v })}
            />

            {/* Instrucciones */}
            <Text style={s.formLabel}>Instrucciones</Text>
            <TextInput
              style={[s.input, { height: 100, textAlignVertical: 'top' }]}
              placeholder="Describe en detalle lo que debe hacerse..."
              placeholderTextColor="#475569"
              value={datos.instrucciones}
              onChangeText={v => onChange({ ...datos, instrucciones: v })}
              multiline
            />

            {/* Prioridad */}
            <Text style={s.formLabel}>Prioridad</Text>
            <View style={s.chipWrap}>
              {prioridades.map(p => {
                const cfg = PRIORIDAD_CFG[p];
                const activo = datos.prioridad === p;
                return (
                  <TouchableOpacity
                    key={p}
                    style={[s.chipSelector, activo && { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                    onPress={() => onChange({ ...datos, prioridad: p })}
                  >
                    <Text style={[s.chipSelectorText, activo && { color: cfg.color }]}>{cfg.icon} {p}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Estado */}
            <Text style={s.formLabel}>Estado</Text>
            <View style={s.chipWrap}>
              {estados.map(e => {
                const cfg = ESTADO_CFG[e];
                const activo = datos.estado === e;
                return (
                  <TouchableOpacity
                    key={e}
                    style={[s.chipSelector, activo && { borderColor: cfg.color, backgroundColor: cfg.bg }]}
                    onPress={() => onChange({ ...datos, estado: e })}
                  >
                    <Text style={[s.chipSelectorText, activo && { color: cfg.color }]}>{e}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Fecha de Finalización */}
            <Text style={s.formLabel}>Fecha Límite</Text>
            <TouchableOpacity 
              style={s.inputDate} 
              onPress={() => setShowPicker(true)}
            >
              <Text style={{ color: datos.fecha_finalizacion ? '#e2e8f4' : '#475569' }}>
                {datos.fecha_finalizacion 
                  ? formatFecha(datos.fecha_finalizacion) 
                  : '📅 Seleccionar fecha'}
              </Text>
              {datos.fecha_finalizacion && (
                <TouchableOpacity onPress={() => onChange({ ...datos, fecha_finalizacion: null })}>
                  <Text style={{color: '#ef4444', fontSize: 12}}>Limpiar</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {showPicker && (
              <DateTimePicker
                value={datos.fecha_finalizacion ? new Date(datos.fecha_finalizacion) : new Date()}
                mode="date"
                display="default"
                onChange={onDateChange}
                minimumDate={new Date()} // Evita fechas pasadas
              />
            )}

            {/* Botones */}
            <TouchableOpacity
              style={[s.btnPrimario, enviando && { opacity: 0.6 }]}
              onPress={onGuardar}
              disabled={enviando}
            >
              {enviando
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnPrimarioText}>{editando ? 'Actualizar' : 'Crear Tarea'}</Text>
              }
            </TouchableOpacity>
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
export default function TareasView() {
  const [tareas,          setTareas]          = useState([]);
  const [proyectos,       setProyectos]       = useState([]);
  const [usuarios,        setUsuarios]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [busqueda,        setBusqueda]        = useState('');
  const [filtroEstado,    setFiltroEstado]    = useState(null);
  const [filtroPrioridad, setFiltroPrioridad] = useState(null);
  const [tareaDetalle,    setTareaDetalle]    = useState(null);
  const [mostrarDetalle,  setMostrarDetalle]  = useState(false);
  const [mostrarForm,     setMostrarForm]     = useState(false);
  const [editandoId,      setEditandoId]      = useState(null);
  const [enviando,        setEnviando]        = useState(false);

  const [formData, setFormData] = useState({
    proyecto_id: null, empleado_id: null,
    titulo: '', instrucciones: '',
    prioridad: 'Media', estado: 'Pendiente',
    fecha_finalizacion: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rT, rP, rU] = await Promise.all([
        getTodasTareas(),
        getProyectos(),
        getUsuarios(),
      ]);
      setTareas(rT);
      setProyectos(rP);
      setUsuarios(rU);
    } catch (err) {
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const stats = {
    total:      tareas.length,
    pendiente:  tareas.filter(t => t.estado === 'Pendiente').length,
    progreso:   tareas.filter(t => t.estado === 'En Progreso').length,
    revision:   tareas.filter(t => t.estado === 'En Revisión').length,
    completada: tareas.filter(t => t.estado === 'Completada').length,
  };

  const tareasFiltradas = tareas.filter(t => {
    const term = busqueda.toLowerCase();
    const coincide =
      t.titulo?.toLowerCase().includes(term) ||
      t.proyectos?.nombre_proyecto?.toLowerCase().includes(term) ||
      t.perfiles?.nombre?.toLowerCase().includes(term);
    const estado = filtroEstado ? t.estado === filtroEstado : true;
    const prio   = filtroPrioridad ? t.prioridad === filtroPrioridad : true;
    return coincide && estado && prio;
  });

  const abrirDetalle = (t) => {
    setTareaDetalle(t);
    setMostrarDetalle(true);
  };

  const abrirForm = (t = null) => {
    if (t) {
      setFormData({
        proyecto_id: t.proyecto_id, empleado_id: t.empleado_id,
        titulo: t.titulo, instrucciones: t.instrucciones || '',
        prioridad: t.prioridad, estado: t.estado,
        fecha_finalizacion: t.fecha_finalizacion || '',
      });
      setEditandoId(t.id);
    } else {
      setFormData({ proyecto_id: null, empleado_id: null, titulo: '', instrucciones: '', prioridad: 'Media', estado: 'Pendiente', fecha_finalizacion: '' });
      setEditandoId(null);
    }
    setMostrarForm(true);
  };

  const handleGuardar = async () => {
    if (!formData.proyecto_id || !formData.empleado_id || !formData.titulo.trim()) {
      Alert.alert('Error', 'Proyecto, responsable y título son requeridos');
      return;
    }
    setEnviando(true);
    try {
      if (editandoId) {
        await actualizarTareaAdmin(editandoId, formData);
      } else {
        await crearTarea(formData);
      }
      setMostrarForm(false);
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo guardar la tarea');
    } finally {
      setEnviando(false);
    }
  };

  const handleEliminar = (id) => {
    const tarea = tareas.find(t => t.id === id);
    Alert.alert(
      '¿Eliminar tarea?',
      `Se eliminará "${tarea?.titulo || 'esta tarea'}" permanentemente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await eliminarTarea(id);
              setMostrarDetalle(false);
              fetchData();
            } catch (err) {
              Alert.alert('Error', 'No se pudo eliminar la tarea');
            }
          }
        }
      ]
    );
  };

  const handleActualizar = async (id, cambios) => {
    try {
      const data = await actualizarTareaAdmin(id, cambios);
      const actualizada = Array.isArray(data) ? data[0] : data;
      setTareas(prev => prev.map(t => t.id === id ? { ...t, ...actualizada } : t));
      if (tareaDetalle?.id === id) setTareaDetalle(prev => ({ ...prev, ...actualizada }));
    } catch (err) {
      Alert.alert('Error', 'No se pudo actualizar el estado');
    }
  };

  return (
    <View style={s.container}>

      {/* Stats — scroll horizontal fijo */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.statsScroll}
        contentContainerStyle={s.statsContent}
      >
        {[
          { label: 'Total',       val: stats.total,      color: '#3b82f6', filtro: null },
          { label: 'Pendiente',   val: stats.pendiente,  color: '#64748b', filtro: 'Pendiente' },
          { label: 'En Progreso', val: stats.progreso,   color: '#3b82f6', filtro: 'En Progreso' },
          { label: 'En Revisión', val: stats.revision,   color: '#f59e0b', filtro: 'En Revisión' },
          { label: 'Completadas', val: stats.completada, color: '#10b981', filtro: 'Completada' },
        ].map(st => (
          <TouchableOpacity
            key={st.label}
            style={[s.statCard, filtroEstado === st.filtro && { borderColor: st.color }]}
            onPress={() => setFiltroEstado(filtroEstado === st.filtro ? null : st.filtro)}
          >
            <Text style={s.statLabel}>{st.label}</Text>
            <Text style={[s.statVal, { color: st.color }]}>{st.val}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Búsqueda + botón nuevo */}
      <View style={s.toolbar}>
        <TextInput
          style={s.searchInput}
          placeholder="🔍  Buscar tarea, proyecto..."
          placeholderTextColor="#475569"
          value={busqueda}
          onChangeText={setBusqueda}
        />
        <TouchableOpacity style={s.btnNuevo} onPress={() => abrirForm()}>
          <Text style={s.btnNuevoText}>+ Nueva</Text>
        </TouchableOpacity>
      </View>

      {/* Filtro prioridad — */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.filtroScroll}
        contentContainerStyle={s.filtroContent}
      >
        {[null, 'Urgente', 'Alta', 'Media', 'Baja'].map(p => (
          <TouchableOpacity
            key={p ?? 'todas'}
            style={[s.chipFiltro, filtroPrioridad === p && s.chipFiltroActivo]}
            onPress={() => setFiltroPrioridad(p)}
          >
            <Text style={[s.chipFiltroText, filtroPrioridad === p && { color: '#3b82f6' }]}>
              {p === null ? 'Todas' : `${PRIORIDAD_CFG[p].icon} ${p}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={s.subText}>Cargando tareas...</Text>
        </View>
      ) : tareasFiltradas.length === 0 ? (
        <View style={s.centered}>
          <Text style={{ fontSize: 40 }}>📋</Text>
          <Text style={s.subText}>No hay tareas que coincidan.</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} 
              refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchData}
              tintColor="#3b82f6" // Color del spinner en iOS
              colors={["#3b82f6"]} // Colores del spinner en Android
              progressBackgroundColor="#0f1520"
            />
          }
        >
          {tareasFiltradas.map(t => {
            const pCfg = PRIORIDAD_CFG[t.prioridad] || PRIORIDAD_CFG['Baja'];
            const eCfg = ESTADO_CFG[t.estado] || ESTADO_CFG['Pendiente'];

            return (
              <TouchableOpacity key={t.id} style={s.card} onPress={() => abrirDetalle(t)}>

                {/* Top */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={s.codigoSerie}>{t.codigo_serie}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                    <View style={[s.badge, { backgroundColor: pCfg.bg }]}>
                      <Text style={[s.badgeText, { color: pCfg.color }]}>{pCfg.icon} {t.prioridad}</Text>
                    </View>
                    <TouchableOpacity onPress={() => abrirForm(t)}>
                      <Text style={s.iconBtn}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleEliminar(t.id)}>
                      <Text style={s.iconBtn}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Info */}
                <Text style={s.cardEmpresa}>
                  🏢 {t.proyectos?.clientes?.empresa} / {t.proyectos?.nombre_proyecto}
                </Text>
                <Text style={s.cardTitulo} numberOfLines={2}>{t.titulo}</Text>

                {/* Responsable */}
                {t.perfiles?.nombre && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>{t.perfiles.nombre.charAt(0)}</Text>
                    </View>
                    <Text style={s.subText}>{t.perfiles.nombre}</Text>
                  </View>
                )}

                {/* Avance */}
                <View style={{ marginTop: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={s.subText}>Avance</Text>
                    <Text style={s.subText}>{t.avance || 0}%</Text>
                  </View>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${t.avance || 0}%`, backgroundColor: eCfg.dot }]} />
                  </View>
                </View>

                {/* Footer */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                  <View style={[s.badge, { backgroundColor: eCfg.bg }]}>
                    <View style={[s.dot, { backgroundColor: eCfg.dot }]} />
                    <Text style={[s.badgeText, { color: eCfg.color }]}>{t.estado}</Text>
                  </View>
                  {t.estado === 'Completada' && t.fecha_completada ? (
                    <Text style={{ fontSize: 11, color: '#10b981', fontWeight: '600' }}>
                      ✓ {formatFecha(t.fecha_completada)}
                    </Text>
                  ) : t.fecha_finalizacion ? (
                    <Text style={s.subText}>{formatFecha(t.fecha_finalizacion)}</Text>
                  ) : null}
                </View>

              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Modales */}
      <ModalDetalle
        tarea={tareaDetalle}
        visible={mostrarDetalle}
        onCerrar={() => setMostrarDetalle(false)}
        onEditar={(t) => { setMostrarDetalle(false); abrirForm(t); }}
        onEliminar={handleEliminar}
        onActualizar={handleActualizar}
      />

      <ModalForm
        visible={mostrarForm}
        editando={!!editandoId}
        datos={formData}
        onChange={setFormData}
        onGuardar={handleGuardar}
        onCerrar={() => setMostrarForm(false)}
        enviando={enviando}
        proyectos={proyectos}
        usuarios={usuarios}
      />

    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#06090f', padding: 16 },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },

  statsScroll:   { flexGrow: 0, flexShrink: 0, marginBottom: 14 },
  statsContent:  { flexDirection: 'row', gap: 10, paddingRight: 4 },
  statCard: {
    backgroundColor: '#0f1520',
    borderRadius: 12,
    padding: 12,
    width: 90,           
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  statLabel: { color: '#64748b', fontSize: 10, marginBottom: 4 },
  statVal:   { fontSize: 20, fontWeight: '800' },

  toolbar:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
  searchInput: {
    flex: 1,
    backgroundColor: '#0f1520',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#e2e8f4',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  btnNuevo:     { backgroundColor: '#3b82f6', borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' },
  btnNuevoText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  // Filtro prioridad 
  filtroScroll:   { flexGrow: 0, flexShrink: 0, marginBottom: 14 },
  filtroContent:  { flexDirection: 'row', gap: 8, paddingRight: 4 },
  chipFiltro: {
    
    alignSelf: 'flex-start',
    backgroundColor: '#0f1520',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  chipFiltroActivo: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)' },
  chipFiltroText:   { color: '#64748b', fontSize: 12 },

  inputDate: {
    backgroundColor: '#0f1520',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },

  card: {
    backgroundColor: '#0f1520',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  codigoSerie: {
    color: '#64748b', fontSize: 11, fontFamily: 'monospace',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  cardEmpresa: { color: '#3b82f6', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  cardTitulo:  { color: '#e2e8f4', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  badge: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, gap: 5,
  },
  badgeText:    { fontSize: 11.5, fontWeight: '600' },
  dot:          { width: 6, height: 6, borderRadius: 3 },
  avatar:       { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center' },
  avatarText:   { color: '#60a5fa', fontSize: 10, fontWeight: '700' },
  progressTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3 },
  iconBtn:       { fontSize: 16, padding: 2 },
  subText:       { color: '#64748b', fontSize: 11 },

  // Modales
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#0f1520', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitulo:    { color: '#e2e8f4', fontSize: 17, fontWeight: '800', flex: 1 },
  cerrarBtn:      { color: '#64748b', fontSize: 20, padding: 4 },
  quickinfo:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  qiItem:         { backgroundColor: '#151d2e', borderRadius: 10, padding: 12, flex: 1, minWidth: '40%' },
  qiLabel:        { color: '#64748b', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  qiVal:          { color: '#e2e8f4', fontSize: 13, fontWeight: '700' },

  
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    
  },
  chipEstado: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#151d2e', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'flex-start',
  },
  chipEstadoText: { color: '#64748b', fontSize: 12 },

  tab: {
    backgroundColor: '#151d2e', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    alignSelf: 'flex-start',
  },
  tabActivo:     { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)' },
  tabText:       { color: '#64748b', fontSize: 12 },
  tabTextActivo: { color: '#3b82f6' },

  instruccionesBox:  { backgroundColor: '#151d2e', borderRadius: 12, padding: 16 },
  instruccionesText: { color: '#94a3b8', fontSize: 14, lineHeight: 22 },
  emptyState:        { alignItems: 'center', paddingVertical: 30 },
  emptyText:         { color: '#64748b', fontSize: 13 },
  extraItem:         { backgroundColor: '#151d2e', borderRadius: 12, padding: 14, marginBottom: 10 },
  extraContenido:    { color: '#e2e8f4', fontSize: 13.5, lineHeight: 20 },
  extraMeta:         { color: '#64748b', fontSize: 11 },
  linkItem:          { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#151d2e', borderRadius: 12, padding: 14, marginBottom: 10 },
  linkNombre:        { color: '#3b82f6', fontSize: 13.5, fontWeight: '600' },
  panelTitle:        { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  formLabel:         { color: '#e2e8f4', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input:             { backgroundColor: '#151d2e', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, color: '#e2e8f4', fontSize: 14, marginBottom: 14 },

  chipWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14,
  },
  chipSelector: {
    backgroundColor: '#151d2e',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    alignSelf: 'flex-start',   
  },
  chipSelectorActive: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)' },
  chipSelectorText:   { color: '#64748b', fontSize: 13 },

  btnPrimario:     { backgroundColor: '#3b82f6', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  btnPrimarioText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecundario:   { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  btnSecundarioText: { color: '#64748b', fontWeight: '600' },
  btnDanger:       { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  btnDangerText:   { color: '#f87171', fontWeight: '600' },
});