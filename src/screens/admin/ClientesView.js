import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, ScrollView, RefreshControl, Modal, KeyboardAvoidingView, Platform
} from 'react-native';

import { getClientes, crearCliente, actualizarCliente, eliminarCliente } from '../../services/api';

const ESTADO_CFG = {
  'Activo':   { color: '#10b981', bg: 'rgba(16,185,129,0.12)', dot: '#10b981' },
  'Inactivo': { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  dot: '#ef4444' },
};

const PROY_ESTADO_CFG = {
  'Planificación': { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  'En Progreso':   { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  'Finalizado':    { color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
};

export default function ClientesView() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState(null);

  // Estados para Modales
  const [clienteDetalle, setClienteDetalle] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [formData, setFormData] = useState({
    empresa: '', nombre_contacto: '', email: '', telefono: '', estado: 'Activo'
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await getClientes();
      setClientes(data || []);
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudieron cargar los clientes');
    } finally {
      setLoading(false);
    }
  };

  const abrirForm = (cliente = null) => {
    if (cliente) {
      setFormData({
        empresa: cliente.empresa,
        nombre_contacto: cliente.nombre_contacto,
        email: cliente.email,
        telefono: cliente.telefono || '',
        estado: cliente.estado
      });
      setEditandoId(cliente.id);
    } else {
      setFormData({ empresa: '', nombre_contacto: '', email: '', telefono: '', estado: 'Activo' });
      setEditandoId(null);
    }
    setMostrarForm(true);
  };

  const handleGuardar = async () => {
    if (!formData.empresa || !formData.email) {
      return Alert.alert('Atención', 'Empresa y Email son obligatorios');
    }

    setEnviando(true);
    try {
      if (editandoId) {
        await actualizarCliente(editandoId, formData);
      } else {
        await crearCliente(formData);
      }
      setMostrarForm(false);
      fetchData();
    } catch (error) {
      Alert.alert('Error', error.message || 'No se pudo guardar');
    } finally {
      setEnviando(false);
    }
  };

  const handleEliminar = (id, nombre) => {
    Alert.alert(
      '¿Eliminar cliente?',
      `Se eliminará "${nombre}" y sus datos asociados.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await eliminarCliente(id);
              setClienteDetalle(null);
              fetchData();
            } catch (error) {
              Alert.alert('Error', error.message || 'No se pudo eliminar');
            }
          } 
        }
      ]
    );
  };

  const stats = {
    total: clientes.length,
    activos: clientes.filter(c => c.estado === 'Activo').length,
    inactivos: clientes.filter(c => c.estado === 'Inactivo').length,
  };

  const clientesFiltrados = clientes.filter(c => {
    const term = busqueda.toLowerCase();
    const coincide = c.empresa?.toLowerCase().includes(term) || c.nombre_contacto?.toLowerCase().includes(term);
    const estado = filtroEstado ? c.estado === filtroEstado : true;
    return coincide && estado;
  });

  const renderCard = ({ item }) => {
    const cfg = ESTADO_CFG[item.estado] || ESTADO_CFG['Activo'];
    const numProyectos = item.proyectos?.length || 0;

    return (
      <TouchableOpacity 
        style={styles.card} 
        activeOpacity={0.7} 
        onPress={() => setClienteDetalle(item)}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <View style={[styles.dot, { backgroundColor: cfg.dot }]} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>{item.estado}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 20 }}>
            <TouchableOpacity onPress={() => abrirForm(item)}>
              <Text style={styles.iconAction}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleEliminar(item.id, item.empresa)}>
              <Text style={styles.iconAction}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.empresaText}>{item.empresa}</Text>
        <Text style={styles.infoText}>👤 {item.nombre_contacto}</Text>
        
        <View style={styles.cardFooter}>
          <Text style={styles.proyectosCount}>{numProyectos} proyectos</Text>
          <Text style={styles.detailLink}>Ver detalle →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={{ height: 90 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>
          {[{ label: 'Total', val: stats.total, color: '#3b82f6', filtro: null },
            { label: 'Activos', val: stats.activos, color: '#10b981', filtro: 'Activo' },
            { label: 'Inactivos', val: stats.inactivos, color: '#ef4444', filtro: 'Inactivo' }
          ].map((s) => (
            <TouchableOpacity 
              key={s.label} 
              style={[styles.statCard, filtroEstado === s.filtro && { borderColor: s.color, borderWidth: 1 }]}
              onPress={() => setFiltroEstado(s.filtro === filtroEstado ? null : s.filtro)}
            >
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar empresa..."
          placeholderTextColor="#64748b"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      <FlatList
        data={clientesFiltrados}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderCard}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#3b82f6" colors={["#3b82f6"]} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No hay clientes</Text>}
      />

      <TouchableOpacity style={styles.fab} onPress={() => abrirForm()}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* MODAL DETALLE (Card desde abajo) */}
      <Modal visible={!!clienteDetalle} animationType="slide" transparent onRequestClose={() => setClienteDetalle(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {clienteDetalle && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeaderIndicator} />
                <Text style={styles.modalTitle}>{clienteDetalle.empresa}</Text>
                <Text style={styles.modalSubText}>👤 {clienteDetalle.nombre_contacto}</Text>
                <Text style={styles.modalSubText}>✉️ {clienteDetalle.email}</Text>
                {clienteDetalle.telefono && <Text style={styles.modalSubText}>📞 {clienteDetalle.telefono}</Text>}
                
                <View style={styles.separator} />
                <Text style={styles.sectionTitle}>PROYECTOS ASIGNADOS</Text>
                
                {(clienteDetalle.proyectos || []).length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>Este cliente no tiene proyectos aún.</Text>
                  </View>
                ) : (
                  clienteDetalle.proyectos.map(p => {
                    const pCfg = PROY_ESTADO_CFG[p.estado] || { color: '#64748b', bg: 'rgba(255,255,255,0.05)' };
                    return (
                      <View key={p.id} style={styles.proyItem}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.proyName}>{p.nombre_proyecto}</Text>
                          {p.fecha_fin && <Text style={styles.proyDate}>Fin: {p.fecha_fin}</Text>}
                        </View>
                        <View style={[styles.badge, { backgroundColor: pCfg.bg, alignSelf: 'center' }]}>
                          <Text style={[styles.badgeText, { color: pCfg.color }]}>{p.estado}</Text>
                        </View>
                      </View>
                    );
                  })
                )}

                <TouchableOpacity style={styles.btnClose} onPress={() => setClienteDetalle(null)}>
                  <Text style={styles.btnCloseText}>Cerrar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL FORMULARIO */}
      <Modal visible={mostrarForm} animationType="fade" transparent onRequestClose={() => setMostrarForm(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={[styles.modalContent, { padding: 25 }]}>
            <Text style={styles.modalTitle}>{editandoId ? '✏️ Editar Cliente' : '➕ Nuevo Cliente'}</Text>
            
            <TextInput 
              style={styles.input} placeholder="Nombre de la Empresa" placeholderTextColor="#64748b" 
              value={formData.empresa} onChangeText={(t) => setFormData({...formData, empresa: t})} 
            />
            <TextInput 
              style={styles.input} placeholder="Nombre del Contacto" placeholderTextColor="#64748b" 
              value={formData.nombre_contacto} onChangeText={(t) => setFormData({...formData, nombre_contacto: t})} 
            />
            <TextInput 
              style={styles.input} placeholder="Correo electrónico" placeholderTextColor="#64748b" keyboardType="email-address" autoCapitalize="none"
              value={formData.email} onChangeText={(t) => setFormData({...formData, email: t})} 
            />
            <TextInput 
              style={styles.input} placeholder="Teléfono" placeholderTextColor="#64748b" keyboardType="phone-pad"
              value={formData.telefono} onChangeText={(t) => setFormData({...formData, telefono: t})} 
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.btnSec} onPress={() => setMostrarForm(false)}>
                <Text style={styles.btnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrim} onPress={handleGuardar} disabled={enviando}>
                <Text style={styles.btnText}>{enviando ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06090f' },
  statsScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 10 },
  statCard: { backgroundColor: '#0b121f', padding: 12, borderRadius: 12, minWidth: 100, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  statLabel: { color: '#64748b', fontSize: 11, fontWeight: '600' },
  statVal: { fontSize: 20, fontWeight: '800' },
  searchContainer: { paddingHorizontal: 16, marginBottom: 10 },
  searchInput: { backgroundColor: '#0b121f', borderRadius: 10, padding: 12, color: '#fff', borderWeight: 1, borderColor: '#1e293b' },
  listContent: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#0b121f', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  empresaText: { color: '#e2e8f4', fontSize: 18, fontWeight: '700', marginBottom: 4 },
  infoText: { color: '#64748b', fontSize: 13, marginBottom: 12 },
  cardFooter: { borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  proyectosCount: { color: '#94a3b8', fontSize: 12 },
  detailLink: { color: '#3b82f6', fontSize: 12, fontWeight: '600' },
  iconAction: { fontSize: 20 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 },
  fabText: { color: '#fff', fontSize: 35, fontWeight: '300' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0b121f', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, maxHeight: '85%' },
  modalHeaderIndicator: { width: 40, height: 5, backgroundColor: '#1e293b', borderRadius: 3, alignSelf: 'center', marginBottom: 15 },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 10 },
  modalSubText: { color: '#94a3b8', fontSize: 15, marginBottom: 6 },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 20 },
  sectionTitle: { color: '#3b82f6', fontSize: 12, fontWeight: '800', letterSpacing: 1.5, marginBottom: 15 },
  proyItem: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#06090f', padding: 15, borderRadius: 15, marginBottom: 10, borderWidth: 1, borderColor: '#1e293b' },
  proyName: { color: '#e2e8f4', fontWeight: '700', fontSize: 15 },
  proyDate: { color: '#64748b', fontSize: 12, marginTop: 4 },
  btnClose: { marginTop: 25, backgroundColor: '#1e293b', padding: 16, borderRadius: 15, alignItems: 'center', marginBottom: 20 },
  btnCloseText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  input: { backgroundColor: '#06090f', color: '#fff', padding: 18, borderRadius: 12, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#1e293b' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
  btnPrim: { flex: 1, backgroundColor: '#3b82f6', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnSec: { flex: 1, backgroundColor: '#1e293b', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  emptyContainer: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#64748b', textAlign: 'center', fontSize: 14 }
});