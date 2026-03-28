// screens/MisTareasScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity,
  TextInput, Modal, ActivityIndicator, Alert, Linking,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { getMisTareas, actualizarTarea, getExtras } from '../services/api';
import { supabase } from '../services/auth';
import { useAuth } from '../context/AuthContext';

// ── Configs ───────────────────────────────────────────────────────────────────
const PRIORIDAD_CFG = {
  'Urgente': { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: '🔴' },
  'Alta':    { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   icon: '🔴' },
  'Media':   { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', icon: '🟡' },
  'Baja':    { color: '#10b981', bg: 'rgba(16,185,129,0.15)', icon: '🟢' },
};

const ESTADO_CFG = {
  'Pendiente':   { color: '#64748b', bg: 'rgba(100,116,139,0.15)', dot: '#94a3b8' },
  'En Progreso': { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  dot: '#3b82f6' },
  'En Revisión': { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  dot: '#f59e0b' },
  'Completada':  { color: '#10b981', bg: 'rgba(16,185,129,0.15)',  dot: '#10b981' },
};

const calcDiasRestantes = (fechaFin) => {
  if (!fechaFin) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fin = new Date(fechaFin); fin.setHours(0, 0, 0, 0);
  return Math.ceil((fin - hoy) / (1000 * 60 * 60 * 24));
};

const formatFecha = (f) =>
  f ? new Date(f).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

// ── Alerta de días ────────────────────────────────────────────────────────────
const AlertaDias = ({ dias }) => {
  if (dias === null) return null;
  const cfg =
    dias < 0  ? { label: `⚠ Vencida hace ${Math.abs(dias)}d`, color: '#ef4444', bg: 'rgba(239,68,68,0.15)' } :
    dias === 0 ? { label: '🔥 Vence hoy',                      color: '#f97316', bg: 'rgba(249,115,22,0.15)' } :
    dias <= 3  ? { label: `⏰ ${dias}d restantes`,              color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' } :
    dias <= 7  ? { label: `📅 ${dias}d restantes`,              color: '#60a5fa', bg: 'rgba(59,130,246,0.12)' } :
                { label: `✓ ${dias}d restantes`,               color: '#34d399', bg: 'rgba(16,185,129,0.1)'  };
  return (
    <View style={[ta.alerta, { backgroundColor: cfg.bg }]}>
      <Text style={[ta.alertaText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};

// ── Modal de detalle ──────────────────────────────────────────────────────────
const ModalDetalle = ({ tarea, visible, onCerrar, onActualizar }) => {
  const { session } = useAuth();
  const miId = session?.user?.id;

  const [tab,             setTab]             = useState('info');
  const [avance,          setAvance]          = useState(tarea?.avance || 0);
  const [avanceTmp,       setAvanceTmp]       = useState(tarea?.avance || 0);
  const [guardandoAvance, setGuardandoAvance] = useState(false);
  const [comentarios,     setComentarios]     = useState([]);
  const [links,           setLinks]           = useState([]);
  const [cargandoExtras,  setCargandoExtras]  = useState(false);
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [nuevoLink,       setNuevoLink]       = useState('');
  const [nombreLink,      setNombreLink]      = useState('');
  const [guardandoExtra,  setGuardandoExtra]  = useState(false);
  const [historial,       setHistorial]       = useState([]);

  useEffect(() => {
    if (tarea) { setAvance(tarea.avance || 0); setAvanceTmp(tarea.avance || 0); }
  }, [tarea?.id]);

  useEffect(() => {
    if (visible && tarea && (tab === 'comentarios' || tab === 'links')) {
      cargarExtras();
    }
  }, [visible, tab, tarea?.id]);

  const agregarAlHistorial = (texto, tipo) =>
    setHistorial(prev => [{ fecha: new Date().toISOString(), texto, tipo }, ...prev]);

  const cargarExtras = async () => {
    if (!tarea) return;
    setCargandoExtras(true);
    try {
      const data = await getExtras(tarea.id);
      setComentarios(data.filter(e => e.tipo === 'comentario'));
      setLinks(data.filter(e => e.tipo === 'link'));
    } catch { /* silencioso */ }
    finally { setCargandoExtras(false); }
  };

  const handleGuardarAvance = async () => {
    setGuardandoAvance(true);
    try {
      await actualizarTarea(tarea.id, { avance: avanceTmp });
      setAvance(avanceTmp);
      onActualizar(tarea.id, { avance: avanceTmp });
      agregarAlHistorial(`Avance actualizado a ${avanceTmp}%`, 'avance');
    } catch {
      Alert.alert('Error', 'No se pudo actualizar el avance');
    } finally {
      setGuardandoAvance(false);
    }
  };

  const handleCambiarEstado = async (nuevoEstado) => {
    try {
      await actualizarTarea(tarea.id, { estado: nuevoEstado });
      onActualizar(tarea.id, { estado: nuevoEstado });
      agregarAlHistorial(`Estado cambiado a "${nuevoEstado}"`, 'estado');
    } catch {
      Alert.alert('Error', 'No se pudo cambiar el estado');
    }
  };

  const handleAgregarComentario = async () => {
    if (!nuevoComentario.trim()) return;
    setGuardandoExtra(true);
    try {
      const { error } = await supabase.from('tarea_extras').insert({
        tarea_id:   tarea.id,
        usuario_id: miId,
        tipo:       'comentario',
        contenido:  nuevoComentario.trim(),
      });
      if (error) throw error;
      setNuevoComentario('');
      cargarExtras();
    } catch {
      Alert.alert('Error', 'No se pudo guardar la nota');
    } finally {
      setGuardandoExtra(false);
    }
  };

  const handleAgregarLink = async () => {
    if (!nuevoLink.trim()) return;
    if (!nuevoLink.startsWith('http')) {
      Alert.alert('URL inválida', 'La URL debe comenzar con http:// o https://');
      return;
    }
    setGuardandoExtra(true);
    try {
      const { error } = await supabase.from('tarea_extras').insert({
        tarea_id:   tarea.id,
        usuario_id: miId,
        tipo:       'link',
        contenido:  nuevoLink.trim(),
        nombre:     nombreLink.trim() || null,
      });
      if (error) throw error;
      setNuevoLink(''); setNombreLink('');
      cargarExtras();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el enlace');
    } finally {
      setGuardandoExtra(false);
    }
  };

  const handleEliminarExtra = (id) => {
    Alert.alert('¿Eliminar?', 'Se borrará este elemento.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          await supabase.from('tarea_extras').delete().eq('id', id);
          cargarExtras();
        },
      },
    ]);
  };

  if (!tarea) return null;
  const pCfg  = PRIORIDAD_CFG[tarea.prioridad] || PRIORIDAD_CFG['Baja'];
  const eCfg  = ESTADO_CFG[tarea.estado] || ESTADO_CFG['Pendiente'];
  const dias  = calcDiasRestantes(tarea.fecha_finalizacion);
  const estado = tarea.estado;

  const TABS = [
    { key: 'info',        label: '📋 Instrucciones' },
    { key: 'comentarios', label: `💬 Notas${comentarios.length > 0 ? ` (${comentarios.length})` : ''}` },
    { key: 'links',       label: `🔗 Links${links.length > 0 ? ` (${links.length})` : ''}` },
    { key: 'historial',   label: `📜 Historial${historial.length > 0 ? ` (${historial.length})` : ''}` },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCerrar}>
      <View style={ta.modalOverlay}>
        <View style={ta.modalContainer}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Header */}
            <View style={ta.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  <Text style={ta.codigoSerie}>{tarea.codigo_serie}</Text>
                  <View style={[ta.badge, { backgroundColor: pCfg.bg }]}>
                    <Text style={[ta.badgeText, { color: pCfg.color }]}>{pCfg.icon} {tarea.prioridad}</Text>
                  </View>
                  <View style={[ta.badge, { backgroundColor: eCfg.bg, flexDirection: 'row', gap: 5, alignItems: 'center' }]}>
                    <View style={[ta.dot, { backgroundColor: eCfg.dot }]} />
                    <Text style={[ta.badgeText, { color: eCfg.color }]}>{tarea.estado}</Text>
                  </View>
                </View>
                <Text style={ta.modalTitulo}>{tarea.titulo}</Text>
              </View>
              <TouchableOpacity onPress={onCerrar} style={ta.cerrarBtn}>
                <Text style={ta.cerrarBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Quickinfo */}
            <View style={ta.quickinfo}>
              <View style={ta.qiItem}>
                <Text style={ta.qiLabel}>Proyecto</Text>
                <Text style={ta.qiVal} numberOfLines={2}>{tarea.proyectos?.nombre_proyecto || '—'}</Text>
              </View>
              <View style={ta.qiItem}>
                <Text style={ta.qiLabel}>Inicio</Text>
                <Text style={ta.qiVal}>{formatFecha(tarea.fecha_inicio)}</Text>
              </View>
              <View style={ta.qiItem}>
                <Text style={ta.qiLabel}>Vencimiento</Text>
                <Text style={ta.qiVal}>{formatFecha(tarea.fecha_finalizacion)}</Text>
              </View>
              <View style={ta.qiItem}>
                <Text style={ta.qiLabel}>Tiempo</Text>
                <AlertaDias dias={dias} />
              </View>
            </View>

            {/* Avance con slider */}
            <View style={ta.avanceSection}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={ta.panelTitle}>AVANCE</Text>
                <Text style={[ta.avanceVal, { color: eCfg.dot }]}>{avanceTmp}%</Text>
              </View>
              <View style={ta.progressTrack}>
                <View style={[ta.progressFill, { width: `${avanceTmp}%`, backgroundColor: eCfg.dot }]} />
              </View>
              <Slider
                style={{ width: '100%', height: 36, marginTop: 4 }}
                minimumValue={0}
                maximumValue={100}
                step={1}
                value={avanceTmp}
                onValueChange={setAvanceTmp}
                minimumTrackTintColor="#3b82f6"
                maximumTrackTintColor="rgba(255,255,255,0.1)"
                thumbTintColor="#3b82f6"
              />
              <TouchableOpacity
                style={[ta.btnPrimario, guardandoAvance && { opacity: 0.6 }]}
                onPress={handleGuardarAvance}
                disabled={guardandoAvance}
              >
                {guardandoAvance
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={ta.btnPrimarioText}>Guardar avance ({avanceTmp}%)</Text>
                }
              </TouchableOpacity>
            </View>

            {/* Acciones de estado */}
            <View style={ta.accionesRow}>
              {estado === 'Pendiente' && (
                <TouchableOpacity
                  style={ta.btnAccion}
                  onPress={() => handleCambiarEstado('En Progreso')}
                >
                  <Text style={ta.btnAccionText}>▶ Iniciar Tarea</Text>
                </TouchableOpacity>
              )}
              {estado === 'En Progreso' && (
                <TouchableOpacity
                  style={[ta.btnAccion, ta.btnAccionWarning]}
                  onPress={() => handleCambiarEstado('En Revisión')}
                >
                  <Text style={[ta.btnAccionText, { color: '#f59e0b' }]}>📤 Enviar a Revisión</Text>
                </TouchableOpacity>
              )}
              {estado === 'En Revisión' && (
                <View style={[ta.badge, { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 14, paddingVertical: 10 }]}>
                  <Text style={{ color: '#f59e0b', fontSize: 13, fontWeight: '600' }}>
                    ⏳ En espera de revisión del admin
                  </Text>
                </View>
              )}
              {estado === 'Completada' && (
                <View style={[ta.badge, { backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 14, paddingVertical: 10 }]}>
                  <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '600' }}>
                    ✅ Tarea completada
                  </Text>
                </View>
              )}
            </View>

            {/* Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {TABS.map(tb => (
                  <TouchableOpacity
                    key={tb.key}
                    style={[ta.tab, tab === tb.key && ta.tabActivo]}
                    onPress={() => setTab(tb.key)}
                  >
                    <Text style={[ta.tabText, tab === tb.key && ta.tabTextActivo]}>{tb.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Tab: Instrucciones */}
            {tab === 'info' && (
              tarea.instrucciones
                ? <View style={ta.instruccionesBox}><Text style={ta.instruccionesText}>{tarea.instrucciones}</Text></View>
                : <View style={ta.emptyState}><Text style={ta.emptyText}>Sin instrucciones específicas.</Text></View>
            )}

            {/* Tab: Notas / Comentarios */}
            {tab === 'comentarios' && (
              <>
                <View style={ta.addBox}>
                  <TextInput
                    style={[ta.addInput, { height: 80, textAlignVertical: 'top' }]}
                    placeholder="Escribe una nota o comentario..."
                    placeholderTextColor="#3a4558"
                    value={nuevoComentario}
                    onChangeText={setNuevoComentario}
                    multiline
                  />
                  <TouchableOpacity
                    style={[ta.btnAdd, guardandoExtra && { opacity: 0.6 }]}
                    onPress={handleAgregarComentario}
                    disabled={guardandoExtra}
                  >
                    <Text style={ta.btnAddText}>{guardandoExtra ? 'Guardando...' : 'Agregar nota'}</Text>
                  </TouchableOpacity>
                </View>

                {cargandoExtras
                  ? <ActivityIndicator color="#3b82f6" style={{ marginTop: 16 }} />
                  : comentarios.length === 0
                    ? <View style={ta.emptyState}><Text style={ta.emptyText}>¡Agrega la primera nota!</Text></View>
                    : comentarios.map(co => (
                        <View key={co.id} style={ta.extraItem}>
                          <Text style={ta.extraContenido}>{co.contenido}</Text>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, alignItems: 'center' }}>
                            <Text style={ta.extraMeta}>
                              {new Date(co.creado_en).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </Text>
                            <TouchableOpacity onPress={() => handleEliminarExtra(co.id)} style={ta.btnEliminar}>
                              <Text style={ta.btnEliminarText}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))
                }
              </>
            )}

            {/* Tab: Links */}
            {tab === 'links' && (
              <>
                <View style={ta.addBox}>
                  <TextInput
                    style={ta.addInput}
                    placeholder="URL (https://...)"
                    placeholderTextColor="#3a4558"
                    value={nuevoLink}
                    onChangeText={setNuevoLink}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                  <TextInput
                    style={[ta.addInput, { marginTop: 8 }]}
                    placeholder="Nombre del enlace (opcional)"
                    placeholderTextColor="#3a4558"
                    value={nombreLink}
                    onChangeText={setNombreLink}
                  />
                  <TouchableOpacity
                    style={[ta.btnAdd, guardandoExtra && { opacity: 0.6 }]}
                    onPress={handleAgregarLink}
                    disabled={guardandoExtra}
                  >
                    <Text style={ta.btnAddText}>{guardandoExtra ? 'Guardando...' : '+ Agregar enlace'}</Text>
                  </TouchableOpacity>
                </View>

                {cargandoExtras
                  ? <ActivityIndicator color="#3b82f6" style={{ marginTop: 16 }} />
                  : links.length === 0
                    ? <View style={ta.emptyState}><Text style={ta.emptyText}>No hay enlaces adjuntos.</Text></View>
                    : links.map(l => (
                        <View key={l.id} style={ta.linkItem}>
                          <Text style={{ fontSize: 20 }}>🔗</Text>
                          <TouchableOpacity style={{ flex: 1 }} onPress={() => Linking.openURL(l.contenido)}>
                            <Text style={ta.linkNombre} numberOfLines={1}>{l.nombre || l.contenido}</Text>
                            <Text style={ta.extraMeta}>{formatFecha(l.creado_en)}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleEliminarExtra(l.id)} style={ta.btnEliminar}>
                            <Text style={ta.btnEliminarText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))
                }
              </>
            )}

            {/* Tab: Historial de sesión */}
            {tab === 'historial' && (
              historial.length === 0
                ? <View style={ta.emptyState}>
                    <Text style={ta.emptyText}>
                      El historial aparece aquí cuando realizas cambios en esta sesión.
                    </Text>
                  </View>
                : historial.map((h, i) => (
                    <View key={i} style={ta.historialItem}>
                      <View style={[ta.historialDot, { backgroundColor: h.tipo === 'estado' ? '#3b82f6' : '#10b981' }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={ta.historialTexto}>{h.texto}</Text>
                        <Text style={ta.historialFecha}>
                          {new Date(h.fecha).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  ))
            )}

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ── Tarjeta de tarea ──────────────────────────────────────────────────────────
const TareaCard = ({ tarea, onPress }) => {
  const pCfg  = PRIORIDAD_CFG[tarea.prioridad] || PRIORIDAD_CFG['Baja'];
  const eCfg  = ESTADO_CFG[tarea.estado] || ESTADO_CFG['Pendiente'];
  const dias  = calcDiasRestantes(tarea.fecha_finalizacion);
  const avance = tarea.avance || 0;
  const urgente = dias !== null && dias <= 3 && tarea.estado !== 'Completada';

  return (
    <TouchableOpacity
      style={[ta.card, urgente && ta.cardUrgente]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {urgente && <View style={ta.cardUrgenteBar} />}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={ta.codigoSerie}>{tarea.codigo_serie}</Text>
        <View style={[ta.badge, { backgroundColor: pCfg.bg }]}>
          <Text style={[ta.badgeText, { color: pCfg.color }]}>{pCfg.icon} {tarea.prioridad}</Text>
        </View>
      </View>

      {tarea.proyectos?.nombre_proyecto && (
        <Text style={ta.cardProyecto}>📁 {tarea.proyectos.nombre_proyecto}</Text>
      )}
      <Text style={ta.cardTitulo} numberOfLines={2}>{tarea.titulo}</Text>

      <View style={{ marginTop: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={ta.subText}>Avance</Text>
          <Text style={ta.subText}>{avance}%</Text>
        </View>
        <View style={ta.progressTrack}>
          <View style={[ta.progressFill, { width: `${avance}%`, backgroundColor: eCfg.dot }]} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
        <View style={[ta.badge, { backgroundColor: eCfg.bg, flexDirection: 'row', gap: 5, alignItems: 'center' }]}>
          <View style={[ta.dot, { backgroundColor: eCfg.dot }]} />
          <Text style={[ta.badgeText, { color: eCfg.color }]}>{tarea.estado}</Text>
        </View>
        <AlertaDias dias={dias} />
      </View>

      {(tarea.fecha_inicio || tarea.fecha_finalizacion) && (
        <View style={ta.cardFechas}>
          <Text style={ta.subText}>📅 {formatFecha(tarea.fecha_inicio)}</Text>
          <Text style={ta.subText}>→</Text>
          <Text style={ta.subText}>{formatFecha(tarea.fecha_finalizacion)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ── Vista principal ───────────────────────────────────────────────────────────
export default function MisTareasScreen() {
  const [tareas,         setTareas]         = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [busqueda,       setBusqueda]       = useState('');
  const [filtroEstado,   setFiltroEstado]   = useState(null);
  const [filtroPrio,     setFiltroPrio]     = useState(null);
  const [tareaDetalle,   setTareaDetalle]   = useState(null);
  const [mostrarDetalle, setMostrarDetalle] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMisTareas();
      setTareas(data || []);
    } catch {
      Alert.alert('Error', 'No se pudieron cargar tus tareas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stats = {
    total:      tareas.length,
    pendiente:  tareas.filter(t => t.estado === 'Pendiente').length,
    progreso:   tareas.filter(t => t.estado === 'En Progreso').length,
    revision:   tareas.filter(t => t.estado === 'En Revisión').length,
    urgentes:   tareas.filter(t => {
      const d = calcDiasRestantes(t.fecha_finalizacion);
      return d !== null && d <= 3 && t.estado !== 'Completada';
    }).length,
  };

  const STAT_ITEMS = [
    { label: 'Total',      val: stats.total,     color: '#3b82f6', filtro: null            },
    { label: 'Pendiente',  val: stats.pendiente, color: '#64748b', filtro: 'Pendiente'     },
    { label: 'En Curso',   val: stats.progreso,  color: '#3b82f6', filtro: 'En Progreso'   },
    { label: 'Revisión',   val: stats.revision,  color: '#f59e0b', filtro: 'En Revisión'   },
    { label: '⚠ Urgentes', val: stats.urgentes,  color: '#ef4444', filtro: '__urgentes__'  },
  ];

  const tareasFiltradas = tareas.filter(t => {
    const term = busqueda.toLowerCase();
    const coincide = t.titulo?.toLowerCase().includes(term) ||
      t.codigo_serie?.toLowerCase().includes(term) ||
      t.proyectos?.nombre_proyecto?.toLowerCase().includes(term);
    const porEstado = filtroEstado === '__urgentes__'
      ? (() => { const d = calcDiasRestantes(t.fecha_finalizacion); return d !== null && d <= 3 && t.estado !== 'Completada'; })()
      : filtroEstado ? t.estado === filtroEstado : true;
    const porPrio = filtroPrio ? t.prioridad === filtroPrio : true;
    return coincide && porEstado && porPrio;
  });

  const handleActualizar = (id, cambios) => {
    setTareas(prev => prev.map(t => t.id === id ? { ...t, ...cambios } : t));
    if (tareaDetalle?.id === id) setTareaDetalle(prev => ({ ...prev, ...cambios }));
  };

  return (
    <View style={ta.container}>

      {/* Stats / filtros */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={ta.statsScroll} contentContainerStyle={ta.statsContent}>
        {STAT_ITEMS.map(st => (
          <TouchableOpacity
            key={st.label}
            style={[ta.statCard, filtroEstado === st.filtro && { borderColor: st.color }]}
            onPress={() => setFiltroEstado(filtroEstado === st.filtro ? null : st.filtro)}
          >
            <Text style={ta.statLabel}>{st.label}</Text>
            <Text style={[ta.statVal, { color: st.color }]}>{st.val}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Búsqueda */}
      <View style={ta.toolbar}>
        <TextInput
          style={ta.searchInput}
          placeholder="🔍  Buscar por título o código..."
          placeholderTextColor="#475569"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {/* Filtro prioridad */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        style={ta.filtroScroll} contentContainerStyle={ta.filtroContent}>
        {[null, 'Alta', 'Media', 'Baja'].map(p => (
          <TouchableOpacity
            key={p ?? 'todas'}
            style={[ta.chipFiltro, filtroPrio === p && ta.chipFiltroActivo]}
            onPress={() => setFiltroPrio(p)}
          >
            <Text style={[ta.chipFiltroText, filtroPrio === p && { color: '#3b82f6' }]}>
              {p === null ? 'Todas' : `${PRIORIDAD_CFG[p]?.icon} ${p}`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Lista */}
      {loading ? (
        <View style={ta.centered}>
          <ActivityIndicator color="#3b82f6" size="large" />
          <Text style={ta.subText}>Cargando tareas...</Text>
        </View>
      ) : tareasFiltradas.length === 0 ? (
        <View style={ta.centered}>
          <Text style={{ fontSize: 40 }}>📭</Text>
          <Text style={ta.subText}>No hay tareas que coincidan.</Text>
        </View>
      ) : (
        <FlatList
          data={tareasFiltradas}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TareaCard
              tarea={item}
              onPress={() => { setTareaDetalle(item); setMostrarDetalle(true); }}
            />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}

      {/* Modal detalle */}
      {tareaDetalle && (
        <ModalDetalle
          tarea={tareaDetalle}
          visible={mostrarDetalle}
          onCerrar={() => setMostrarDetalle(false)}
          onActualizar={handleActualizar}
        />
      )}
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const ta = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#06090f', padding: 16 },
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 60 },

  statsScroll:  { flexGrow: 0, flexShrink: 0, marginBottom: 12 },
  statsContent: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  statCard:     { backgroundColor: '#0f1520', borderRadius: 12, padding: 12, width: 90, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  statLabel:    { color: '#64748b', fontSize: 10, marginBottom: 4 },
  statVal:      { fontSize: 20, fontWeight: '800' },

  toolbar:      { flexDirection: 'row', marginBottom: 10 },
  searchInput:  { flex: 1, backgroundColor: '#0f1520', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: '#e2e8f4', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },

  filtroScroll:   { flexGrow: 0, flexShrink: 0, marginBottom: 14 },
  filtroContent:  { flexDirection: 'row', gap: 8, paddingRight: 4 },
  chipFiltro:     { backgroundColor: '#0f1520', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', alignSelf: 'flex-start' },
  chipFiltroActivo:{ borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)' },
  chipFiltroText: { color: '#64748b', fontSize: 12 },

  card:          { backgroundColor: '#0f1520', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' },
  cardUrgente:   { borderColor: 'rgba(239,68,68,0.3)' },
  cardUrgenteBar:{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#ef4444' },
  cardProyecto:  { color: '#64748b', fontSize: 11, fontFamily: 'monospace', marginBottom: 4 },
  cardTitulo:    { color: '#e2e8f4', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  cardFechas:    { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },

  codigoSerie:   { color: '#3b82f6', fontSize: 11, fontFamily: 'monospace', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badge:         { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  badgeText:     { fontSize: 11.5, fontWeight: '600' },
  dot:           { width: 6, height: 6, borderRadius: 3 },
  progressTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 3 },
  subText:       { color: '#64748b', fontSize: 11 },

  alerta:        { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  alertaText:    { fontSize: 11, fontWeight: '600', fontFamily: 'monospace' },

  // Modal
  modalOverlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: '#0f1520', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '94%' },
  modalHeader:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  modalTitulo:    { color: '#e2e8f4', fontSize: 17, fontWeight: '800', flex: 1, lineHeight: 24 },
  cerrarBtn:      { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  cerrarBtnText:  { color: '#64748b', fontSize: 14 },

  quickinfo:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  qiItem:        { backgroundColor: '#151d2e', borderRadius: 10, padding: 12, flex: 1, minWidth: '40%' },
  qiLabel:       { color: '#64748b', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4, fontFamily: 'monospace' },
  qiVal:         { color: '#e2e8f4', fontSize: 12.5, fontWeight: '600' },

  avanceSection: { marginBottom: 16 },
  panelTitle:    { color: '#64748b', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, fontFamily: 'monospace' },
  avanceVal:     { fontSize: 18, fontWeight: '800' },

  accionesRow:   { marginBottom: 16, gap: 8 },
  btnAccion:     { backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  btnAccionWarning: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' },
  btnAccionText: { color: '#3b82f6', fontWeight: '700', fontSize: 14 },

  tab:           { backgroundColor: '#151d2e', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', alignSelf: 'flex-start' },
  tabActivo:     { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)' },
  tabText:       { color: '#64748b', fontSize: 12 },
  tabTextActivo: { color: '#3b82f6' },

  instruccionesBox:  { backgroundColor: '#151d2e', borderRadius: 12, padding: 16 },
  instruccionesText: { color: '#94a3b8', fontSize: 14, lineHeight: 22 },
  emptyState:        { alignItems: 'center', paddingVertical: 30 },
  emptyText:         { color: '#64748b', fontSize: 13, textAlign: 'center', paddingHorizontal: 20 },

  addBox:         { backgroundColor: '#151d2e', borderRadius: 12, padding: 14, marginBottom: 12, gap: 10 },
  addInput:       { backgroundColor: '#0f1520', borderRadius: 10, padding: 12, color: '#e2e8f4', fontSize: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  btnAdd:         { backgroundColor: '#2563eb', borderRadius: 10, padding: 11, alignItems: 'center' },
  btnAddText:     { color: '#fff', fontWeight: '700', fontSize: 13 },

  extraItem:      { backgroundColor: '#151d2e', borderRadius: 12, padding: 14, marginBottom: 10 },
  extraContenido: { color: '#e2e8f4', fontSize: 13.5, lineHeight: 20 },
  extraMeta:      { color: '#64748b', fontSize: 11 },

  linkItem:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#151d2e', borderRadius: 12, padding: 14, marginBottom: 10 },
  linkNombre:     { color: '#3b82f6', fontSize: 13.5, fontWeight: '600' },

  btnEliminar:     { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  btnEliminarText: { color: '#ef4444', fontSize: 12, fontWeight: '700' },

  historialItem:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  historialDot:   { width: 10, height: 10, borderRadius: 5, marginTop: 3, flexShrink: 0 },
  historialTexto: { color: '#94a3b8', fontSize: 13 },
  historialFecha: { color: '#64748b', fontSize: 11, marginTop: 3, fontFamily: 'monospace' },

  btnPrimario:     { backgroundColor: '#2563eb', borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 4 },
  btnPrimarioText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});