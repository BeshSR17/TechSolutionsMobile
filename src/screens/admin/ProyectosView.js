// screens/admin/ProyectosView.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Dimensions, RefreshControl,
} from 'react-native';
import { getProyectos, getClientes, getTodas, crearProyecto, actualizarProyecto, eliminarProyecto } from '../../services/api';
import { validar, esValido, REGLAS } from '../../hooks/useValidacion';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Configs visuales ──────────────────────────────────────────────────────────
const ESTADO_CFG = {
  'Planificación': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', dot: '#8b5cf6' },
  'En Progreso':   { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  dot: '#f59e0b' },
  'Finalizado':    { color: '#10b981', bg: 'rgba(16,185,129,0.15)',  dot: '#10b981' },
  'Cancelado':     { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   dot: '#ef4444' },
};

const TAREA_ESTADO = {
  'Pendiente':   { color: '#64748b' },
  'En Progreso': { color: '#3b82f6' },
  'En Revisión': { color: '#f59e0b' },
  'Completada':  { color: '#10b981' },
};

const formatFecha = (f) =>
  f ? new Date(f).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '—';

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

// ── Campo con error inline ────────────────────────────────────────────────────
const Campo = ({ label, error, children, required }) => (
  <View style={s.formField}>
    <Text style={s.formLabel}>
      {label}{required && <Text style={{ color: '#ef4444' }}> *</Text>}
    </Text>
    {children}
    {error ? <Text style={s.errorMsg}>{error}</Text> : null}
  </View>
);

// ── Modal Detalle ─────────────────────────────────────────────────────────────
const ModalDetalle = ({ visible, proyecto, tareas, onCerrar, onEditar, onEliminar }) => {
  if (!proyecto) return null;
  const cfg = ESTADO_CFG[proyecto.estado] || ESTADO_CFG['Planificación'];
  const avanceTotal = tareas.length
    ? Math.round(tareas.reduce((acc, t) => acc + (t.avance || 0), 0) / tareas.length)
    : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={s.modalOverlay}>
        <View style={[s.modalContainer, { height: SCREEN_HEIGHT * 0.85 }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalHeaderSmall}>Detalle del Proyecto</Text>
            <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => { onCerrar(); onEditar(proyecto); }}>
                <Text style={{ fontSize: 20 }}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onEliminar(proyecto.id)}>
                <Text style={{ fontSize: 20 }}>🗑️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onCerrar}>
                <Text style={s.cerrarBtn}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[s.badge, { backgroundColor: cfg.bg, alignSelf: 'flex-start', marginBottom: 12 }]}>
              <View style={[s.dot, { backgroundColor: cfg.dot }]} />
              <Text style={[s.badgeText, { color: cfg.color }]}>{proyecto.estado}</Text>
            </View>
            <Text style={s.detTitle}>{proyecto.nombre_proyecto}</Text>
            <Text style={s.detSub}>🏢 {proyecto.clientes?.empresa}</Text>

            {proyecto.descripcion ? (
              <View style={s.descripcionBox}>
                <Text style={s.descripcionText}>{proyecto.descripcion}</Text>
              </View>
            ) : null}

            <View style={s.statsGrid}>
              <View style={s.statBox}>
                <Text style={s.statBoxLabel}>Tareas</Text>
                <Text style={[s.statBoxVal, { color: '#3b82f6' }]}>{tareas.length}</Text>
              </View>
              <View style={s.statBox}>
                <Text style={s.statBoxLabel}>Avance</Text>
                <Text style={[s.statBoxVal, { color: '#10b981' }]}>{avanceTotal}%</Text>
              </View>
            </View>

            <View style={s.seccion}>
              <Text style={s.seccionTitle}>Tareas Recientes</Text>
              {tareas.length === 0 ? (
                <Text style={s.emptyText}>Sin tareas asignadas.</Text>
              ) : (
                tareas.map(t => (
                  <View key={t.id} style={s.taskItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.taskTitle}>{t.titulo}</Text>
                      <Text style={s.taskUser}>👤 {t.perfiles?.nombre || 'Sin asignar'}</Text>
                    </View>
                    <Text style={[s.taskStatus, { color: (TAREA_ESTADO[t.estado] || TAREA_ESTADO['Pendiente']).color }]}>
                      {t.avance || 0}%
                    </Text>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── Modal Formulario ──────────────────────────────────────────────────────────
const ModalForm = ({ visible, editando, datos, onChange, onGuardar, onCerrar, enviando, clientes, errores, onLimpiarError }) => {
  const estados = Object.keys(ESTADO_CFG);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={s.modalOverlay}>
        <View style={s.modalContainer}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitulo}>{editando ? '✏️ Editar Proyecto' : '➕ Nuevo Proyecto'}</Text>
            <TouchableOpacity onPress={onCerrar}>
              <Text style={s.cerrarBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Cliente */}
            <Campo label="Cliente responsable" error={errores.cliente_id} required>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <View style={s.chipRow}>
                  {clientes.map(c => (
                    <TouchableOpacity
                      key={c.id}
                      style={[s.chip, datos.cliente_id === c.id && s.chipActive,
                              errores.cliente_id && s.chipError]}
                      onPress={() => { onChange({ ...datos, cliente_id: c.id }); onLimpiarError('cliente_id'); }}
                    >
                      <Text style={[s.chipText, datos.cliente_id === c.id && s.chipTextActive]}>
                        🏢 {c.empresa}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </Campo>

            {/* Nombre */}
            <Campo label="Nombre del proyecto" error={errores.nombre_proyecto} required>
              <TextInput
                style={[s.input, errores.nombre_proyecto && s.inputError]}
                placeholder="Ej: App Móvil"
                placeholderTextColor="#475569"
                value={datos.nombre_proyecto}
                onChangeText={v => { onChange({ ...datos, nombre_proyecto: v }); onLimpiarError('nombre_proyecto'); }}
              />
            </Campo>

            {/* Descripción */}
            <Campo label="Descripción" error={errores.descripcion}>
              <TextInput
                style={[s.input, { height: 80, textAlignVertical: 'top' }, errores.descripcion && s.inputError]}
                placeholder="Detalles del proyecto..."
                placeholderTextColor="#475569"
                value={datos.descripcion}
                onChangeText={v => { onChange({ ...datos, descripcion: v }); onLimpiarError('descripcion'); }}
                multiline
              />
            </Campo>

            {/* Estado */}
            <Campo label="Estado actual" error={errores.estado}>
              <View style={s.chipWrap}>
                {estados.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[s.chip, datos.estado === e && { borderColor: ESTADO_CFG[e].color, backgroundColor: ESTADO_CFG[e].bg }]}
                    onPress={() => { onChange({ ...datos, estado: e }); onLimpiarError('estado'); }}
                  >
                    <Text style={[s.chipText, datos.estado === e && { color: ESTADO_CFG[e].color }]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </Campo>

            <TouchableOpacity
              style={[s.btnPrimario, enviando && { opacity: 0.6 }]}
              onPress={onGuardar}
              disabled={enviando}
            >
              {enviando
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnPrimarioText}>{editando ? 'Actualizar' : 'Crear Proyecto'}</Text>
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
export default function ProyectosView() {
  const [proyectos,         setProyectos]         = useState([]);
  const [clientes,          setClientes]           = useState([]);
  const [todasLasTareas,    setTodasLasTareas]     = useState([]);
  const [loading,           setLoading]            = useState(true);
  const [busqueda,          setBusqueda]           = useState('');
  const [filtroEstado,      setFiltroEstado]       = useState(null);
  const [enviando,          setEnviando]           = useState(false);
  const [mostrarForm,       setMostrarForm]        = useState(false);
  const [mostrarDetalle,    setMostrarDetalle]     = useState(false);
  const [editandoId,        setEditandoId]         = useState(null);
  const [proyectoSel,       setProyectoSel]        = useState(null);
  const [errores,           setErrores]            = useState({});
  const [formData, setFormData] = useState({
    cliente_id: null, nombre_proyecto: '', descripcion: '', estado: 'Planificación',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [p, c, t] = await Promise.all([getProyectos(), getClientes(), getTodas()]);
      setProyectos(p || []);
      setClientes(c || []);
      setTodasLasTareas(t || []);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = {
    total:         proyectos.length,
    planificacion: proyectos.filter(p => p.estado === 'Planificación').length,
    progreso:      proyectos.filter(p => p.estado === 'En Progreso').length,
    finalizado:    proyectos.filter(p => p.estado === 'Finalizado').length,
    cancelado:     proyectos.filter(p => p.estado === 'Cancelado').length,
  };

  // ── Filtrado ───────────────────────────────────────────────────────────────
  const proyectosFiltrados = proyectos.filter(p => {
    const term = busqueda.toLowerCase();
    const coincide =
      p.nombre_proyecto?.toLowerCase().includes(term) ||
      p.clientes?.empresa?.toLowerCase().includes(term);
    const estado = filtroEstado ? p.estado === filtroEstado : true;
    return coincide && estado;
  });

  // ── Formulario ─────────────────────────────────────────────────────────────
  const abrirForm = (p = null) => {
    setErrores({});
    if (p) {
      setEditandoId(p.id);
      setFormData({
        cliente_id: p.cliente_id,
        nombre_proyecto: p.nombre_proyecto,
        descripcion: p.descripcion || '',
        estado: p.estado,
      });
    } else {
      setEditandoId(null);
      setFormData({ cliente_id: null, nombre_proyecto: '', descripcion: '', estado: 'Planificación' });
    }
    setMostrarForm(true);
  };

  const limpiarError = (campo) =>
    setErrores(prev => { const next = { ...prev }; delete next[campo]; return next; });

  const handleGuardar = async () => {
    const esquema = {
      cliente_id:      [REGLAS.noVacio],
      nombre_proyecto: [REGLAS.requerido, REGLAS.minLength(3), REGLAS.maxLength(100)],
      descripcion:     [REGLAS.maxLength(500)],
    };
    const errs = validar(formData, esquema);
    setErrores(errs);
    if (!esValido(errs)) return;

    setEnviando(true);
    try {
      if (editandoId) {
        await actualizarProyecto(editandoId, formData);
      } else {
        await crearProyecto(formData);
      }
      setMostrarForm(false);
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.message || 'No se pudo guardar el proyecto');
    } finally {
      setEnviando(false);
    }
  };

  const handleEliminar = (id) => {
    const p = proyectos.find(x => x.id === id);
    Alert.alert(
      '¿Eliminar proyecto?',
      `Se eliminará "${p?.nombre_proyecto || 'este proyecto'}" permanentemente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await eliminarProyecto(id);
              setMostrarDetalle(false);
              fetchData();
            } catch (err) {
              Alert.alert('Error', err.message || 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={s.container}>

      {/* Stats / filtros ────────────────────────────────────────────────────── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.statsScroll}
        contentContainerStyle={s.statsContent}
        
      >
        <StatChip label="Total"         val={stats.total}         color="#3b82f6" activo={filtroEstado === null}           onPress={() => setFiltroEstado(null)} />
        <StatChip label="Planificación" val={stats.planificacion} color="#8b5cf6" activo={filtroEstado === 'Planificación'} onPress={() => setFiltroEstado(filtroEstado === 'Planificación' ? null : 'Planificación')} />
        <StatChip label="En Progreso"   val={stats.progreso}      color="#f59e0b" activo={filtroEstado === 'En Progreso'}   onPress={() => setFiltroEstado(filtroEstado === 'En Progreso' ? null : 'En Progreso')} />
        <StatChip label="Finalizado"    val={stats.finalizado}    color="#10b981" activo={filtroEstado === 'Finalizado'}    onPress={() => setFiltroEstado(filtroEstado === 'Finalizado' ? null : 'Finalizado')} />
        <StatChip label="Cancelado"     val={stats.cancelado}     color="#ef4444" activo={filtroEstado === 'Cancelado'}     onPress={() => setFiltroEstado(filtroEstado === 'Cancelado' ? null : 'Cancelado')} />
      </ScrollView>

      {/* Buscador ───────────────────────────────────────────────────────────── */}
      <View style={s.toolbar}>
        <TextInput
          style={s.searchInput}
          placeholder="🔍 Buscar proyecto o cliente..."
          placeholderTextColor="#475569"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {/* Lista ──────────────────────────────────────────────────────────────── */}
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={s.subText}>Cargando proyectos...</Text>
        </View>
      ) : proyectosFiltrados.length === 0 ? (
        <View style={s.centered}>
          <Text style={{ fontSize: 40 }}>📁</Text>
          <Text style={s.subText}>No hay proyectos que coincidan.</Text>
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={{ paddingBottom: 100 }}
          // Configuración del Pull to Refresh
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={fetchData}
              tintColor="#3b82f6" // Color para iOS
              colors={["#3b82f6"]} // Color para Android
              progressBackgroundColor="#0f1520" // Fondo del circulito en Android
            />
          }
        >
          {proyectosFiltrados.map(p => {
            const tareasP = todasLasTareas.filter(t => t.proyecto_id === p.id);
            const avance  = tareasP.length
              ? Math.round(tareasP.reduce((a, t) => a + (t.avance || 0), 0) / tareasP.length)
              : 0;
            const cfg = ESTADO_CFG[p.estado] || ESTADO_CFG['Planificación'];
            return (
              <TouchableOpacity
                key={p.id}
                style={s.card}
                onPress={() => { setProyectoSel(p); setMostrarDetalle(true); }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={[s.badge, { backgroundColor: cfg.bg }]}>
                    <View style={[s.dot, { backgroundColor: cfg.dot }]} />
                    <Text style={[s.badgeText, { color: cfg.color }]}>{p.estado}</Text>
                  </View>
                  <Text style={s.fechaText}>{formatFecha(p.fecha_inicio)}</Text>
                </View>
                <Text style={s.cardTitulo}>{p.nombre_proyecto}</Text>
                <Text style={s.cardEmpresa}>🏢 {p.clientes?.empresa}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
                  <Text style={s.subText}>{tareasP.length} tarea{tareasP.length !== 1 ? 's' : ''}</Text>
                  <Text style={s.subText}>{avance}%</Text>
                </View>
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${avance}%`, backgroundColor: cfg.dot }]} />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* FAB ────────────────────────────────────────────────────────────────── */}
      <TouchableOpacity style={s.fab} onPress={() => abrirForm()}>
        <Text style={s.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Modales ────────────────────────────────────────────────────────────── */}
      <ModalDetalle
        visible={mostrarDetalle}
        proyecto={proyectoSel}
        tareas={todasLasTareas.filter(t => t.proyecto_id === proyectoSel?.id)}
        onCerrar={() => setMostrarDetalle(false)}
        onEditar={abrirForm}
        onEliminar={handleEliminar}
      />
      <ModalForm
        visible={mostrarForm}
        editando={!!editandoId}
        datos={formData}
        onChange={setFormData}
        onGuardar={handleGuardar}
        onCerrar={() => setMostrarForm(false)}
        enviando={enviando}
        clientes={clientes}
        errores={errores}
        onLimpiarError={limpiarError}
      />
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06090f', padding: 16 },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },

  statsScroll:  { flexGrow: 0, flexShrink: 0, marginBottom: 14 },
  statsContent: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  statCard: {
    backgroundColor: '#0f1520', borderRadius: 12, padding: 12,
    width: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  statLabel: { color: '#64748b', fontSize: 10, marginBottom: 4 },
  statVal:   { fontSize: 20, fontWeight: '800' },

  toolbar:     { flexDirection: 'row', gap: 10, marginBottom: 14 },
  searchInput: {
    flex: 1, backgroundColor: '#0f1520', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, color: '#e2e8f4',
    fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },

  card: {
    backgroundColor: '#0f1520', borderRadius: 16, padding: 16,
    marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  cardTitulo:    { color: '#e2e8f4', fontSize: 15, fontWeight: '700', marginTop: 10 },
  cardEmpresa:   { color: '#64748b', fontSize: 12, marginTop: 4 },
  fechaText:     { color: '#475569', fontSize: 11 },
  badge:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, gap: 6 },
  badgeText:     { fontSize: 11, fontWeight: '700' },
  dot:           { width: 6, height: 6, borderRadius: 3 },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 2 },
  subText:       { color: '#64748b', fontSize: 11 },

  fab: {
    position: 'absolute', bottom: 30, right: 25,
    backgroundColor: '#3b82f6', width: 58, height: 58,
    borderRadius: 29, justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3,
  },
  fabIcon: { color: '#fff', fontSize: 30, fontWeight: '300' },

  modalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContainer:   { backgroundColor: '#0f1520', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' },
  modalHeader:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, alignItems: 'center' },
  modalHeaderSmall: { color: '#94a3b8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  modalTitulo:      { color: '#e2e8f4', fontSize: 18, fontWeight: '800', flex: 1 },
  cerrarBtn:        { color: '#64748b', fontSize: 22, padding: 4 },

  detTitle:       { color: '#e2e8f4', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  detSub:         { color: '#3b82f6', fontSize: 14, fontWeight: '600', marginBottom: 12 },
  descripcionBox: { backgroundColor: '#151d2e', borderRadius: 12, padding: 14, marginBottom: 16 },
  descripcionText:{ color: '#94a3b8', fontSize: 13, lineHeight: 20 },
  statsGrid:      { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statBox:        { flex: 1, backgroundColor: '#151d2e', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  statBoxLabel:   { color: '#64748b', fontSize: 10, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  statBoxVal:     { fontSize: 22, fontWeight: '800', color: '#e2e8f4' },
  seccion:        { marginTop: 10 },
  seccionTitle:   { color: '#e2e8f4', fontSize: 14, fontWeight: '700', marginBottom: 12 },
  taskItem:       { backgroundColor: '#151d2e', padding: 14, borderRadius: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  taskTitle:      { color: '#e2e8f4', fontWeight: '600', fontSize: 13 },
  taskUser:       { color: '#64748b', fontSize: 11, marginTop: 2 },
  taskStatus:     { fontSize: 12, fontWeight: '700', marginLeft: 10 },
  emptyText:      { color: '#64748b', fontSize: 12, textAlign: 'center', paddingVertical: 20 },

  formField: { marginBottom: 16 },
  formLabel: { color: '#e2e8f4', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: '#151d2e', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10, padding: 12, color: '#e2e8f4', fontSize: 14,
  },
  inputError: { borderColor: 'rgba(239,68,68,0.5)' },
  errorMsg:   { fontSize: 11.5, color: '#ef4444', fontFamily: 'monospace', marginTop: 4 },

  chipRow:  { flexDirection: 'row', gap: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    backgroundColor: '#151d2e', paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignSelf: 'flex-start',
  },
  chipActive:    { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)' },
  chipError:     { borderColor: 'rgba(239,68,68,0.3)' },
  chipText:      { color: '#64748b', fontSize: 13 },
  chipTextActive:{ color: '#3b82f6', fontWeight: '700' },

  btnPrimario:     { backgroundColor: '#3b82f6', borderRadius: 12, padding: 15, alignItems: 'center', marginTop: 8 },
  btnPrimarioText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecundario:   { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  btnSecundarioText: { color: '#64748b', fontWeight: '600' },
});