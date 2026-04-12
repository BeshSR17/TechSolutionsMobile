// screens/ChatScreen.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Platform, Image, ActivityIndicator,
  Modal, ScrollView, Dimensions, Keyboard, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { getPerfiles } from '../services/api';

const SCREEN_W = Dimensions.get('window').width;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatHora = (f) =>
  f ? new Date(f).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '';

const formatFechaCorta = (f) => {
  if (!f) return '';
  const d   = new Date(f);
  const hoy = new Date();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString())  return formatHora(f);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
};

const formatFechaLarga = (f) => {
  if (!f) return '';
  return new Date(f).toLocaleDateString('es', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const esAdmin = (perfil) =>
  perfil?.rol === 'Administrador' || perfil?.rol === 'Admin';

// ─────────────────────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────────────────────
const Avatar = ({ url, nombre, size = 44, showOnline = false, isOnline = false }) => {
  const inicial = nombre ? nombre.charAt(0).toUpperCase() : '?';
  return (
    <View style={{ position: 'relative' }}>
      <View style={[av.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
        {url
          ? <Image source={{ uri: url }} style={av.img} />
          : <Text style={[av.inicial, { fontSize: size * 0.4 }]}>{inicial}</Text>
        }
      </View>
      {showOnline && (
        <View style={[av.dot, isOnline ? av.dotOnline : av.dotOffline]} />
      )}
    </View>
  );
};
const av = StyleSheet.create({
  wrap:       { backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img:        { width: '100%', height: '100%' },
  inicial:    { color: '#60a5fa', fontWeight: '800' },
  dot:        { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: '#06090f' },
  dotOnline:  { backgroundColor: '#10b981' },
  dotOffline: { backgroundColor: '#3a4558' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Badge de estado de consulta
// ─────────────────────────────────────────────────────────────────────────────
const EstadoBadge = ({ estado }) => {
  const cfg = {
    pendiente: { color: '#fbbf24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.25)',  label: '⏳ Pendiente' },
    activa:    { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)',  label: '💬 En curso' },
    cerrada:   { color: '#64748b', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.25)', label: '✓ Cerrada' },
  }[estado] || { color: '#64748b', bg: 'transparent', border: 'transparent', label: estado };

  return (
    <View style={[sb.wrap, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Text style={[sb.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
};
const sb = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  text: { fontSize: 11, fontWeight: '700' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Modal: Perfil del contacto
// ─────────────────────────────────────────────────────────────────────────────
const PerfilContacto = ({ contacto, onCerrar }) => {
  const admin = esAdmin(contacto);
  return (
    <Modal visible animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView style={s.perfilModal}>
        <View style={s.perfilHeader}>
          <TouchableOpacity onPress={onCerrar} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
          <Text style={s.perfilHeaderTitle}>Perfil</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.perfilHero}>
            <Avatar url={contacto.avatar_url} nombre={contacto.nombre} size={100}
              showOnline isOnline={contacto.estado === 'Activo'} />
            <Text style={s.perfilNombre}>{contacto.nombre || 'Sin nombre'}</Text>
            <View style={s.perfilRolBadge}>
              <Text style={[s.perfilRolText, admin && { color: '#8b5cf6' }]}>
                {admin ? '👑 Administrador' : '👤 Colaborador'}
              </Text>
            </View>
            <View style={[s.estadoBadge2, contacto.estado === 'Activo' ? s.estadoActivo : s.estadoInactivo]}>
              <View style={[s.estadoDot, { backgroundColor: contacto.estado === 'Activo' ? '#10b981' : '#3a4558' }]} />
              <Text style={[s.estadoText, { color: contacto.estado === 'Activo' ? '#10b981' : '#64748b' }]}>
                {contacto.estado === 'Activo' ? 'En línea' : 'Desconectado'}
              </Text>
            </View>
          </View>
          <View style={s.perfilSection}>
            <Text style={s.perfilSectionTitle}>INFORMACIÓN</Text>
            <View style={s.perfilRow}>
              <Text style={s.perfilRowIcon}>✉️</Text>
              <View>
                <Text style={s.perfilRowLabel}>Correo</Text>
                <Text style={s.perfilRowVal}>{contacto.email || '—'}</Text>
              </View>
            </View>
            {contacto.id_visual ? (
              <View style={s.perfilRow}>
                <Text style={s.perfilRowIcon}>🪪</Text>
                <View>
                  <Text style={s.perfilRowLabel}>ID de colaborador</Text>
                  <Text style={[s.perfilRowVal, { fontFamily: 'monospace' }]}>#{contacto.id_visual}</Text>
                </View>
              </View>
            ) : null}
            {contacto.biografia ? (
              <View style={s.perfilBioBox}>
                <Text style={s.perfilSectionTitle}>BIOGRAFÍA</Text>
                <Text style={s.perfilBioText}>{contacto.biografia}</Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Chat individual (usado tanto para consultas como para chats directos)
// ─────────────────────────────────────────────────────────────────────────────
const ChatIndividual = ({
  miId, contacto, consulta = null,
  onVolver, onFinalizarConsulta, soloLectura = false,
  modoAdmin = false,
}) => {
  const [mensajes,       setMensajes]       = useState([]);
  const [texto,          setTexto]          = useState('');
  const [cargando,       setCargando]       = useState(true);
  const [enviando,       setEnviando]       = useState(false);
  const [verPerfil,      setVerPerfil]      = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatRef = useRef(null);
  const insets  = useSafeAreaInsets();

  useEffect(() => {
    const mostrar = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const ocultar = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidHide' : 'keyboardWillHide',
      () => setKeyboardHeight(0)
    );
    return () => { mostrar.remove(); ocultar.remove(); };
  }, []);

  // Cargar mensajes
  useEffect(() => {
    if (!miId || !contacto?.id) return;
    const cargar = async () => {
      setCargando(true);
      let query = supabase.from('mensajes').select('*');

      if (consulta?.id) {
        // Mensajes de esta consulta específica
        query = query.eq('consulta_id', consulta.id);
      } else {
        // Chat directo (sin consulta)
        query = query
          .is('consulta_id', null)
          .or(
            `and(remitente_id.eq.${miId},destinatario_id.eq.${contacto.id}),` +
            `and(remitente_id.eq.${contacto.id},destinatario_id.eq.${miId})`
          );
      }

      const { data } = await query.order('creado_en', { ascending: true });
      setMensajes(data || []);
      setCargando(false);

      await supabase
        .from('mensajes')
        .update({ leido: true })
        .eq('remitente_id', contacto.id)
        .eq('destinatario_id', miId)
        .or('leido.eq.false,leido.is.null');
    };
    cargar();
  }, [miId, contacto?.id, consulta?.id]);

  useEffect(() => {
    if (!miId || !contacto?.id) return;
    const canalId = consulta?.id
      ? `consulta-${consulta.id}`
      : `chat-${[miId, contacto.id].sort().join('-')}`;

    const canal = supabase
      .channel(canalId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes',
        filter: `destinatario_id=eq.${miId}`,
      }, (payload) => {
        const msg = payload.new;
        const esDeEsteChat = consulta?.id
          ? msg.consulta_id === consulta.id
          : msg.remitente_id === contacto.id && !msg.consulta_id;
        if (esDeEsteChat) {
          setMensajes(prev => [...prev, msg]);
          supabase.from('mensajes').update({ leido: true }).eq('id', msg.id);
        }
      })
      .subscribe();

    let canalConsulta = null;
    if (consulta?.id) {
      canalConsulta = supabase
        .channel(`consulta-estado-${consulta.id}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'consultas',
          filter: `id=eq.${consulta.id}`,
        }, (payload) => {
          if (payload.new.estado === 'cerrada' && onFinalizarConsulta) {
            onFinalizarConsulta(payload.new);
          }
        })
        .subscribe();
    }

    return () => {
      supabase.removeChannel(canal);
      if (canalConsulta) supabase.removeChannel(canalConsulta);
    };
  }, [miId, contacto?.id, consulta?.id]);

  // Auto-scroll
  useEffect(() => {
    if (mensajes.length > 0 && flatRef.current) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [mensajes]);

  const handleEnviar = async () => {
    if (!texto.trim() || enviando || soloLectura) return;
    const contenido = texto.trim();
    setTexto('');
    Keyboard.dismiss();

    const optimista = {
      id: `tmp-${Date.now()}`,
      remitente_id: miId,
      destinatario_id: contacto.id,
      contenido,
      consulta_id: consulta?.id || null,
      creado_en: new Date().toISOString(),
      _optimista: true,
    };
    setMensajes(prev => [...prev, optimista]);
    setEnviando(true);

    try {
      const { data } = await supabase
        .from('mensajes')
        .insert({
          remitente_id: miId,
          destinatario_id: contacto.id,
          contenido,
          consulta_id: consulta?.id || null,
        })
        .select()
        .single();
      setMensajes(prev => prev.map(m => m.id === optimista.id ? (data || m) : m));
    } catch {
      setMensajes(prev => prev.filter(m => m.id !== optimista.id));
    } finally {
      setEnviando(false);
    }
  };

  const handleFinalizar = () => {
    Alert.alert(
      'Finalizar consulta',
      '¿Estás seguro de que deseas cerrar esta consulta? Ambos podrán seguir viendo el historial.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Finalizar',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('consultas')
              .update({ estado: 'cerrada', cerrado_en: new Date().toISOString() })
              .eq('id', consulta.id);
            if (onFinalizarConsulta) onFinalizarConsulta();
          },
        },
      ]
    );
  };

  const items = [];
  let fechaActual = null;
  mensajes.forEach(msg => {
    const f = new Date(msg.creado_en).toDateString();
    if (f !== fechaActual) {
      fechaActual = f;
      items.push({ type: 'fecha', id: `f-${f}`, fecha: msg.creado_en });
    }
    items.push({ type: 'msg', ...msg });
  });

  const renderItem = ({ item }) => {
    if (item.type === 'fecha') {
      const hoy  = new Date().toDateString();
      const ayer = new Date(Date.now() - 86400000).toDateString();
      const d    = new Date(item.fecha).toDateString();
      const label = d === hoy ? 'Hoy' : d === ayer ? 'Ayer'
        : new Date(item.fecha).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
      return (
        <View style={s.fechaDivider}>
          <Text style={s.fechaDividerText}>{label}</Text>
        </View>
      );
    }

    const esPropio = item.remitente_id === miId;
    return (
      <View style={[s.msgRow, esPropio ? s.msgRowPropio : s.msgRowAjeno]}>
        {!esPropio && <Avatar url={contacto.avatar_url} nombre={contacto.nombre} size={28} />}
        <View style={[s.burbuja, esPropio ? s.burbujaPropia : s.burbujaAjena,
          item._optimista && { opacity: 0.65 }]}>
          <Text style={[s.burbujaTexto, esPropio ? s.burbujaTextoPropio : s.burbujaTextoAjeno]}>
            {item.contenido}
          </Text>
          <View style={s.msgMeta}>
            <Text style={[s.msgHora, esPropio && { color: 'rgba(255,255,255,0.45)' }]}>
              {formatHora(item.creado_en)}
            </Text>
            {esPropio && (
              <Text style={s.msgTick}>{item._optimista ? '🕐' : '✓✓'}</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const inputPaddingBottom = keyboardHeight > 0
    ? keyboardHeight - insets.bottom + 10
    : Math.max(insets.bottom, 8);

  const consultaCerrada = consulta?.estado === 'cerrada' || soloLectura;

  return (
    <View style={{ flex: 1 }}>
      {/* Header */}
      <View style={s.chatHeader}>
        {onVolver ? (
          <TouchableOpacity onPress={onVolver} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
        ) : <View style={{ width: 40 }} />}

        <TouchableOpacity style={s.chatHeaderInfo} onPress={() => setVerPerfil(true)}>
          <Avatar url={contacto.avatar_url} nombre={contacto.nombre}
            size={38} showOnline isOnline={contacto.estado === 'Activo'} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={s.chatHeaderNombre} numberOfLines={1}>
              {contacto.nombre || 'Administrador'}
            </Text>
            {consulta ? (
              <EstadoBadge estado={consulta.estado} />
            ) : (
              <Text style={[s.chatHeaderEstado, contacto.estado === 'Activo' && { color: '#10b981' }]}>
                {contacto.estado === 'Activo' ? '● En línea' : '○ Desconectado'}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Botón finalizar — solo admin, solo consultas activas */}
        {modoAdmin && consulta && consulta.estado === 'activa' ? (
          <TouchableOpacity style={s.finalizarBtn} onPress={handleFinalizar}>
            <Text style={s.finalizarBtnText}>Finalizar</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.infoBtn} onPress={() => setVerPerfil(true)}>
            <Text style={s.infoBtnIcon}>ℹ️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Banner de consulta cerrada */}
      {consultaCerrada && (
        <View style={s.cerradaBanner}>
          <Text style={s.cerradaBannerText}>
            ✓ Consulta finalizada · {consulta?.cerrado_en ? formatFechaLarga(consulta.cerrado_en) : ''}
          </Text>
        </View>
      )}

      {/* Mensajes */}
      {cargando ? (
        <View style={s.centered}>
          <ActivityIndicator color="#3b82f6" />
          <Text style={s.emptyText}>Cargando mensajes...</Text>
        </View>
      ) : (
        <FlatList
          ref={flatRef}
          data={items}
          keyExtractor={item => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={s.msgList}
          showsVerticalScrollIndicator={false}
          onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={s.centered}>
              <Text style={{ fontSize: 44, marginBottom: 8 }}>👋</Text>
              <Text style={s.emptyText}>¡Inicia la conversación!</Text>
            </View>
          }
        />
      )}

      {/* Input */}
      {consultaCerrada ? (
        <View style={[s.inputArea, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={s.inputCerrado}>
            <Text style={s.inputCerradoText}>Esta consulta está cerrada</Text>
          </View>
        </View>
      ) : (
        <View style={[s.inputArea, { paddingBottom: inputPaddingBottom }]}>
          <TextInput
            style={s.msgInput}
            placeholder="Escribe un mensaje..."
            placeholderTextColor="#3a4558"
            value={texto}
            onChangeText={setTexto}
            multiline
            maxLength={1000}
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[s.sendBtn, (!texto.trim() || enviando) && s.sendBtnDisabled]}
            onPress={handleEnviar}
            disabled={!texto.trim() || enviando}
          >
            <Text style={s.sendIcon}>➤</Text>
          </TouchableOpacity>
        </View>
      )}

      {verPerfil && (
        <PerfilContacto contacto={contacto} onCerrar={() => setVerPerfil(false)} />
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VISTA USUARIO — Nueva consulta
// ─────────────────────────────────────────────────────────────────────────────
const NuevaConsulta = ({ miId, onCreada, onCancelar }) => {
  const [titulo,   setTitulo]   = useState('');
  const [mensaje,  setMensaje]  = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleEnviar = async () => {
    if (!titulo.trim() || !mensaje.trim()) {
      Alert.alert('Campos requeridos', 'Por favor completa el título y el mensaje.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('consultas')
        .insert({ usuario_id: miId, titulo: titulo.trim(), mensaje_inicial: mensaje.trim() })
        .select()
        .single();
      if (error) throw error;
      onCreada(data);
    } catch (e) {
      Alert.alert('Error', 'No se pudo enviar la consulta. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.chatHeader}>
        <TouchableOpacity onPress={onCancelar} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={s.chatHeaderNombre}>Nueva consulta</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled">
        <View style={s.ncInfo}>
          <Text style={s.ncInfoIcon}>💡</Text>
          <Text style={s.ncInfoText}>
            Describe tu consulta y un administrador te responderá lo antes posible.
          </Text>
        </View>

        <View style={s.ncField}>
          <Text style={s.ncLabel}>Título de la consulta</Text>
          <TextInput
            style={s.ncInput}
            placeholder="Ej: Problema con mi tarea #234"
            placeholderTextColor="#334155"
            value={titulo}
            onChangeText={setTitulo}
            maxLength={100}
          />
        </View>

        <View style={s.ncField}>
          <Text style={s.ncLabel}>Describe tu consulta</Text>
          <TextInput
            style={[s.ncInput, s.ncInputMulti]}
            placeholder="Explica detalladamente tu consulta..."
            placeholderTextColor="#334155"
            value={mensaje}
            onChangeText={setMensaje}
            multiline
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={s.ncCounter}>{mensaje.length}/1000</Text>
        </View>

        <TouchableOpacity
          style={[s.ncBtn, loading && { opacity: 0.6 }]}
          onPress={handleEnviar}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.ncBtnText}>Enviar consulta</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VISTA USUARIO — Mensajes directos recibidos de admins
// ─────────────────────────────────────────────────────────────────────────────
const MensajesDirectosUsuario = ({ miId, onAbrir }) => {
  const [admins,    setAdmins]    = useState([]);
  const [ultimoMsg, setUltimoMsg] = useState({});
  const [noLeidos,  setNoLeidos]  = useState({});
  const [loading,   setLoading]   = useState(true);

  const cargar = useCallback(async () => {
    // Buscar todos los admins que le hayan escrito directamente
    const { data: msgs } = await supabase
      .from('mensajes')
      .select('remitente_id')
      .is('consulta_id', null)
      .eq('destinatario_id', miId);

    // IDs únicos de remitentes
    const ids = [...new Set((msgs || []).map(m => m.remitente_id))];
    if (ids.length === 0) { setLoading(false); return; }

    const { data: perfs } = await supabase
      .from('perfiles')
      .select('*')
      .in('id', ids)
      .in('rol', ['Administrador', 'Admin']);

    setAdmins(perfs || []);

    // Último mensaje y no leídos por admin
    const um = {}, nl = {};
    await Promise.all((perfs || []).map(async (a) => {
      const { data: last } = await supabase
        .from('mensajes')
        .select('contenido, creado_en, remitente_id')
        .is('consulta_id', null)
        .or(
          `and(remitente_id.eq.${miId},destinatario_id.eq.${a.id}),` +
          `and(remitente_id.eq.${a.id},destinatario_id.eq.${miId})`
        )
        .order('creado_en', { ascending: false })
        .limit(1);
      if (last?.[0]) um[a.id] = last[0];

      const { count } = await supabase
        .from('mensajes')
        .select('id', { count: 'exact', head: true })
        .is('consulta_id', null)
        .eq('remitente_id', a.id)
        .eq('destinatario_id', miId)
        .eq('leido', false);
      if (count) nl[a.id] = count;
    }));
    setUltimoMsg(um);
    setNoLeidos(nl);
    setLoading(false);
  }, [miId]);

  useEffect(() => { cargar(); }, [cargar]);

  // Realtime — nuevo mensaje directo de un admin
  useEffect(() => {
    const canal = supabase
      .channel(`usuario-directos-${miId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes',
        filter: `destinatario_id=eq.${miId}`,
      }, (payload) => {
        if (!payload.new.consulta_id) {
          cargar(); 
        }
      })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [miId, cargar]);

  if (loading) return <View style={s.centered}><ActivityIndicator color="#3b82f6" /></View>;

  if (admins.length === 0) {
    return (
      <View style={s.centered}>
        <Text style={{ fontSize: 44, marginBottom: 8 }}>📭</Text>
        <Text style={s.emptyTitle}>Sin mensajes aún</Text>
        <Text style={s.emptyText}>Cuando un administrador te escriba directamente, aparecerá aquí.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={admins}
      keyExtractor={item => item.id}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const ultimo = ultimoMsg[item.id];
        const count  = noLeidos[item.id] || 0;
        return (
          <TouchableOpacity
            style={s.conversaItem}
            onPress={() => {
              setNoLeidos(prev => ({ ...prev, [item.id]: 0 }));
              onAbrir(item);
            }}
            activeOpacity={0.75}
          >
            <Avatar url={item.avatar_url} nombre={item.nombre}
              size={50} showOnline isOnline={item.estado === 'Activo'} />
            <View style={s.conversaInfo}>
              <View style={s.conversaTop}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={s.conversaNombre} numberOfLines={1}>{item.nombre || 'Administrador'}</Text>
                  <View style={{ backgroundColor: 'rgba(139,92,246,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(139,92,246,0.2)' }}>
                    <Text style={{ color: '#a78bfa', fontSize: 9, fontWeight: '700' }}>ADMIN</Text>
                  </View>
                </View>
                {ultimo && <Text style={s.conversaHora}>{formatFechaCorta(ultimo.creado_en)}</Text>}
              </View>
              <View style={s.conversaBottom}>
                <Text style={[s.conversaPreview, count > 0 && s.conversaPreviewBold]} numberOfLines={1}>
                  {ultimo
                    ? (ultimo.remitente_id === miId ? 'Tú: ' : '') + ultimo.contenido
                    : 'Sin mensajes'
                  }
                </Text>
                {count > 0 && (
                  <View style={s.badge}>
                    <Text style={s.badgeText}>{count > 99 ? '99+' : count}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
      ItemSeparatorComponent={() => <View style={s.separator} />}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VISTA USUARIO — Lista de sus consultas + mensajes directos
// ─────────────────────────────────────────────────────────────────────────────
const ConsultasUsuario = ({ miId, perfil }) => {
  const [seccion,     setSeccion]     = useState('consultas'); // consultas | mensajes
  const [vista,       setVista]       = useState('lista');     // lista | nueva | chat | chatdirecto
  const [consultas,   setConsultas]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [consultaAct, setConsultaAct] = useState(null);
  const [adminPerfil, setAdminPerfil] = useState(null);
  const [adminDirecto, setAdminDirecto] = useState(null);

  const cargarConsultas = useCallback(async () => {
    const { data } = await supabase
      .from('consultas')
      .select('*')
      .eq('usuario_id', miId)
      .order('creado_en', { ascending: false });
    setConsultas(data || []);
    setLoading(false);
  }, [miId]);

  useEffect(() => { cargarConsultas(); }, [cargarConsultas]);

  useEffect(() => {
    const canal = supabase
      .channel(`consultas-usuario-${miId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'consultas',
        filter: `usuario_id=eq.${miId}`,
      }, () => { cargarConsultas(); })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'consultas',
        filter: `usuario_id=eq.${miId}`,
      }, () => { cargarConsultas(); })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [miId, cargarConsultas]);

  const abrirConsulta = async (consulta) => {
    setConsultaAct(consulta);
    if (consulta.admin_asignado_id) {
      const { data } = await supabase
        .from('perfiles').select('*').eq('id', consulta.admin_asignado_id).single();
      setAdminPerfil(data || { id: consulta.admin_asignado_id, nombre: 'Administrador', avatar_url: null, estado: 'Activo' });
    } else {
      setAdminPerfil({ nombre: 'Administrador', avatar_url: null, estado: 'Activo', id: null });
    }
    setVista('chat');
  };

  // Vista: nueva consulta
  if (vista === 'nueva') {
    return (
      <NuevaConsulta
        miId={miId}
        onCreada={() => { cargarConsultas(); setVista('lista'); }}
        onCancelar={() => setVista('lista')}
      />
    );
  }

  // Vista: chat de consulta
  if (vista === 'chat' && consultaAct && adminPerfil) {
    return (
      <ChatIndividual
        miId={miId}
        contacto={adminPerfil}
        consulta={consultaAct}
        onVolver={() => { setVista('lista'); cargarConsultas(); }}
        soloLectura={consultaAct.estado !== 'activa'}
        modoAdmin={false}
      />
    );
  }

  // Vista: chat directo con admin
  if (vista === 'chatdirecto' && adminDirecto) {
    return (
      <ChatIndividual
        miId={miId}
        contacto={adminDirecto}
        consulta={null}
        onVolver={() => setVista('lista')}
        soloLectura={false}
        modoAdmin={false}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Header con tabs */}
      <View style={s.listaHeader}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.listaHeaderTitle}>
            {seccion === 'consultas' ? 'Mis consultas' : 'Mensajes'}
          </Text>
          {seccion === 'consultas' && (
            <TouchableOpacity style={s.nuevaBtn} onPress={() => setVista('nueva')}>
              <Text style={s.nuevaBtnText}>+ Nueva</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={s.seccionTabs}>
          <TouchableOpacity
            style={[s.seccionTab, seccion === 'consultas' && s.seccionTabActive]}
            onPress={() => setSeccion('consultas')}
          >
            <Text style={[s.seccionTabText, seccion === 'consultas' && s.seccionTabTextActive]}>🎫 Consultas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.seccionTab, seccion === 'mensajes' && s.seccionTabActive]}
            onPress={() => setSeccion('mensajes')}
          >
            <Text style={[s.seccionTabText, seccion === 'mensajes' && s.seccionTabTextActive]}>💬 Mensajes</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Contenido por sección */}
      {seccion === 'consultas' ? (
        loading ? (
          <View style={s.centered}><ActivityIndicator color="#3b82f6" size="large" /></View>
        ) : consultas.length === 0 ? (
          <View style={s.centered}>
            <Text style={{ fontSize: 48, marginBottom: 12 }}>🎫</Text>
            <Text style={s.emptyTitle}>Sin consultas aún</Text>
            <Text style={s.emptyText}>Crea una nueva consulta y un administrador te atenderá.</Text>
            <TouchableOpacity style={[s.ncBtn, { marginTop: 24 }]} onPress={() => setVista('nueva')}>
              <Text style={s.ncBtnText}>Crear primera consulta</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={consultas}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.consultaItem}
                onPress={() => abrirConsulta(item)}
                activeOpacity={0.75}
              >
                <View style={s.consultaItemTop}>
                  <Text style={s.consultaTitulo} numberOfLines={1}>{item.titulo}</Text>
                  <EstadoBadge estado={item.estado} />
                </View>
                <Text style={s.consultaPreview} numberOfLines={2}>{item.mensaje_inicial}</Text>
                <Text style={s.consultaFecha}>{formatFechaCorta(item.creado_en)}</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={s.separator} />}
          />
        )
      ) : (
        <MensajesDirectosUsuario
          miId={miId}
          onAbrir={(adminP) => { setAdminDirecto(adminP); setVista('chatdirecto'); }}
        />
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VISTA ADMIN — Panel de consultas pendientes + activas
// ─────────────────────────────────────────────────────────────────────────────
const AdminConsultas = ({ miId, perfiles, onIrChat }) => {
  const [consultas, setConsultas] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState('pendiente'); // pendiente | activa | cerrada

  const cargar = useCallback(async () => {
    const { data } = await supabase
      .from('consultas')
      .select('*')
      .order('creado_en', { ascending: false });
    setConsultas(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Realtime
  useEffect(() => {
    const canal = supabase
      .channel('admin-consultas-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'consultas' },
        () => cargar())
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [cargar]);

  const aceptarConsulta = async (consulta) => {
    const { data: fresh } = await supabase
      .from('consultas').select('estado').eq('id', consulta.id).single();
    if (fresh?.estado !== 'pendiente') {
      Alert.alert('No disponible', 'Esta consulta ya fue tomada por otro administrador.');
      cargar();
      return;
    }
    await supabase
      .from('consultas')
      .update({ estado: 'activa', admin_asignado_id: miId })
      .eq('id', consulta.id);
    const usuarioPerfil = perfiles.find(p => p.id === consulta.usuario_id);
    onIrChat({ ...consulta, estado: 'activa', admin_asignado_id: miId }, usuarioPerfil);
  };

  const filtradas = consultas.filter(c => c.estado === tab);

  const getUsuario = (id) => perfiles.find(p => p.id === id);

  const tabs = [
    { key: 'pendiente', label: 'Pendientes', color: '#fbbf24' },
    { key: 'activa',    label: 'Activas',    color: '#10b981' },
    { key: 'cerrada',   label: 'Cerradas',   color: '#64748b' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View style={s.listaHeader}>
        <Text style={s.listaHeaderTitle}>Consultas</Text>
        <View style={s.tabsSmall}>
          {tabs.map(t => {
            const cnt = consultas.filter(c => c.estado === t.key).length;
            return (
              <TouchableOpacity
                key={t.key}
                style={[s.tabSmall, tab === t.key && { borderBottomColor: t.color, borderBottomWidth: 2 }]}
                onPress={() => setTab(t.key)}
              >
                <Text style={[s.tabSmallText, tab === t.key && { color: t.color }]}>
                  {t.label}{cnt > 0 ? ` (${cnt})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={s.centered}><ActivityIndicator color="#3b82f6" size="large" /></View>
      ) : filtradas.length === 0 ? (
        <View style={s.centered}>
          <Text style={{ fontSize: 40 }}>
            {tab === 'pendiente' ? '✅' : tab === 'activa' ? '💬' : '📁'}
          </Text>
          <Text style={s.emptyText}>
            {tab === 'pendiente' ? 'Sin consultas pendientes' :
              tab === 'activa'    ? 'Sin consultas activas'    : 'Sin consultas cerradas'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const usuario = getUsuario(item.usuario_id);
            return (
              <View style={s.consultaAdminItem}>
                <View style={s.consultaAdminTop}>
                  <Avatar url={usuario?.avatar_url} nombre={usuario?.nombre} size={40}
                    showOnline isOnline={usuario?.estado === 'Activo'} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={s.consultaTitulo} numberOfLines={1}>{item.titulo}</Text>
                    <Text style={s.consultaUsuarioNombre}>{usuario?.nombre || 'Usuario'}</Text>
                  </View>
                  <Text style={s.consultaFecha}>{formatFechaCorta(item.creado_en)}</Text>
                </View>

                <Text style={s.consultaPreview} numberOfLines={2}>{item.mensaje_inicial}</Text>

                {item.estado === 'pendiente' && (
                  <TouchableOpacity
                    style={s.aceptarBtn}
                    onPress={() => aceptarConsulta(item)}
                  >
                    <Text style={s.aceptarBtnText}>✓ Aceptar consulta</Text>
                  </TouchableOpacity>
                )}

                {(item.estado === 'activa' || item.estado === 'cerrada') && (
                  <TouchableOpacity
                    style={[s.verBtn, item.estado === 'cerrada' && s.verBtnCerrado]}
                    onPress={() => onIrChat(item, usuario)}
                  >
                    <Text style={s.verBtnText}>
                      {item.estado === 'activa' ? '💬 Continuar chat' : '📄 Ver historial'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// VISTA ADMIN — Chats directos (entre admins o con usuarios sin consulta)
// ─────────────────────────────────────────────────────────────────────────────
const AdminChatsDirectos = ({ miId, perfiles, onSeleccionar }) => {
  const [busqueda,  setBusqueda]  = useState('');
  const [noLeidos,  setNoLeidos]  = useState({});
  const [ultimoMsg, setUltimoMsg] = useState({});
  const [loading,   setLoading]   = useState(true);

  const otros = perfiles.filter(p => p.id !== miId);

  useEffect(() => {
    if (!miId || otros.length === 0) return;
    const cargar = async () => {
      const nl = {}, um = {};
      await Promise.all(otros.map(async (u) => {
        const { data: msgs } = await supabase
          .from('mensajes')
          .select('contenido, creado_en, remitente_id')
          .is('consulta_id', null)
          .or(
            `and(remitente_id.eq.${miId},destinatario_id.eq.${u.id}),` +
            `and(remitente_id.eq.${u.id},destinatario_id.eq.${miId})`
          )
          .order('creado_en', { ascending: false })
          .limit(1);
        if (msgs?.[0]) um[u.id] = msgs[0];

        const { count } = await supabase
          .from('mensajes')
          .select('id', { count: 'exact', head: true })
          .is('consulta_id', null)
          .eq('remitente_id', u.id)
          .eq('destinatario_id', miId)
          .eq('leido', false);
        if (count) nl[u.id] = count;
      }));
      setUltimoMsg(um);
      setNoLeidos(nl);
      setLoading(false);
    };
    cargar();
  }, [miId, otros.length]);

  useEffect(() => {
    if (!miId) return;
    const canal = supabase
      .channel('admin-directos-lista')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes',
        filter: `destinatario_id=eq.${miId}`,
      }, (payload) => {
        if (!payload.new.consulta_id) {
          const rid = payload.new.remitente_id;
          setUltimoMsg(prev => ({ ...prev, [rid]: payload.new }));
          setNoLeidos(prev => ({ ...prev, [rid]: (prev[rid] || 0) + 1 }));
        }
      })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [miId]);

  const ordenados = [...otros].sort((a, b) => {
    const tA = ultimoMsg[a.id]?.creado_en || '';
    const tB = ultimoMsg[b.id]?.creado_en || '';
    return tB.localeCompare(tA);
  });

  const filtrados = ordenados.filter(u =>
    u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          placeholder="Buscar persona..."
          placeholderTextColor="#3a4558"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>
      {loading ? (
        <View style={s.centered}><ActivityIndicator color="#3b82f6" size="large" /></View>
      ) : filtrados.length === 0 ? (
        <View style={s.centered}>
          <Text style={{ fontSize: 40 }}>💬</Text>
          <Text style={s.emptyText}>No hay conversaciones directas.</Text>
        </View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const ultimo = ultimoMsg[item.id];
            const count  = noLeidos[item.id] || 0;
            return (
              <TouchableOpacity
                style={s.conversaItem}
                onPress={() => {
                  setNoLeidos(prev => ({ ...prev, [item.id]: 0 }));
                  onSeleccionar(item);
                }}
                activeOpacity={0.75}
              >
                <Avatar url={item.avatar_url} nombre={item.nombre}
                  size={50} showOnline isOnline={item.estado === 'Activo'} />
                <View style={s.conversaInfo}>
                  <View style={s.conversaTop}>
                    <Text style={s.conversaNombre} numberOfLines={1}>{item.nombre || 'Sin nombre'}</Text>
                    {ultimo && <Text style={s.conversaHora}>{formatFechaCorta(ultimo.creado_en)}</Text>}
                  </View>
                  <View style={s.conversaBottom}>
                    <Text style={[s.conversaPreview, count > 0 && s.conversaPreviewBold]} numberOfLines={1}>
                      {ultimo
                        ? (ultimo.remitente_id === miId ? 'Tú: ' : '') + ultimo.contenido
                        : esAdmin(item) ? 'Admin — Iniciar chat' : 'Sin mensajes aún'
                      }
                    </Text>
                    {count > 0 && (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>{count > 99 ? '99+' : count}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PANTALLA PRINCIPAL — Admin
// ─────────────────────────────────────────────────────────────────────────────
const AdminChatScreen = ({ miId, miPerfil }) => {
  const [seccion,    setSeccion]    = useState('consultas'); // consultas | directos
  const [vista,      setVista]      = useState('lista');     // lista | chat
  const [contacto,   setContacto]   = useState(null);
  const [consulta,   setConsulta]   = useState(null);
  const [perfiles,   setPerfiles]   = useState([]);
  const [loadingP,   setLoadingP]   = useState(true);

  useEffect(() => {
    getPerfiles().then(data => {
      setPerfiles(data || []);
      setLoadingP(false);
    });
  }, []);

  const irAChat = (consultaObj, usuarioPerfil) => {
    setConsulta(consultaObj);
    setContacto(usuarioPerfil || { nombre: 'Usuario', avatar_url: null, estado: 'Activo', id: consultaObj.usuario_id });
    setVista('chat');
  };

  const irAChatDirecto = (perfil) => {
    setConsulta(null);
    setContacto(perfil);
    setVista('chat');
  };

  if (loadingP) {
    return <View style={s.centered}><ActivityIndicator color="#3b82f6" size="large" /></View>;
  }

  if (vista === 'chat' && contacto) {
    return (
      <ChatIndividual
        miId={miId}
        contacto={contacto}
        consulta={consulta}
        onVolver={() => { setVista('lista'); setConsulta(null); setContacto(null); }}
        onFinalizarConsulta={() => setVista('lista')}
        modoAdmin
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* Tab principal */}
      <View style={s.listaHeader}>
        <Text style={s.listaHeaderTitle}>
          {seccion === 'consultas' ? 'Consultas' : 'Mensajes'}
        </Text>
        <View style={s.seccionTabs}>
          <TouchableOpacity
            style={[s.seccionTab, seccion === 'consultas' && s.seccionTabActive]}
            onPress={() => setSeccion('consultas')}
          >
            <Text style={[s.seccionTabText, seccion === 'consultas' && s.seccionTabTextActive]}>🎫 Consultas</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.seccionTab, seccion === 'directos' && s.seccionTabActive]}
            onPress={() => setSeccion('directos')}
          >
            <Text style={[s.seccionTabText, seccion === 'directos' && s.seccionTabTextActive]}>💬 Directos</Text>
          </TouchableOpacity>
        </View>
      </View>

      {seccion === 'consultas' ? (
        <AdminConsultas miId={miId} perfiles={perfiles} onIrChat={irAChat} />
      ) : (
        <AdminChatsDirectos miId={miId} perfiles={perfiles} onSeleccionar={irAChatDirecto} />
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PANTALLA RAÍZ
// ─────────────────────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { session, perfil } = useAuth();
  const miId    = session?.user?.id;
  const adminYo = esAdmin(perfil);

  if (!miId) {
    return <View style={s.centered}><ActivityIndicator color="#3b82f6" /></View>;
  }

  return (
    <SafeAreaView style={s.safe} edges={[]}>
      {adminYo
        ? <AdminChatScreen miId={miId} miPerfil={perfil} />
        : <ConsultasUsuario miId={miId} perfil={perfil} />
      }
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Estilos
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#06090f' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 },
  emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
  emptyTitle:{ color: '#94a3b8', fontSize: 16, fontWeight: '700', textAlign: 'center' },

  // ── Header ──
  listaHeader: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  listaHeaderTitle: { color: '#e2e8f4', fontSize: 22, fontWeight: '800' },
  nuevaBtn:    { backgroundColor: 'rgba(37,99,235,0.15)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(37,99,235,0.3)', alignSelf: 'flex-start' },
  nuevaBtnText:{ color: '#60a5fa', fontSize: 13, fontWeight: '700' },

  // ── Tabs admin ──
  tabsSmall:        { flexDirection: 'row', gap: 0 },
  tabSmall:         { paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabSmallText:     { color: '#64748b', fontSize: 12, fontWeight: '600' },
  seccionTabs:      { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 3, gap: 2 },
  seccionTab:       { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  seccionTabActive: { backgroundColor: 'rgba(59,130,246,0.15)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' },
  seccionTabText:   { color: '#64748b', fontSize: 12, fontWeight: '600' },
  seccionTabTextActive: { color: '#60a5fa' },

  // ── Consulta items (usuario) ──
  consultaItem: { padding: 16, gap: 6 },
  consultaItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  consultaTitulo:  { color: '#e2e8f4', fontSize: 14, fontWeight: '700', flex: 1 },
  consultaPreview: { color: '#64748b', fontSize: 13, lineHeight: 18 },
  consultaFecha:   { color: '#3a4558', fontSize: 11 },

  // ── Consulta items (admin) ──
  consultaAdminItem:  { padding: 16, gap: 10 },
  consultaAdminTop:   { flexDirection: 'row', alignItems: 'center' },
  consultaUsuarioNombre: { color: '#64748b', fontSize: 12, marginTop: 2 },
  aceptarBtn:  { backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  aceptarBtnText: { color: '#10b981', fontSize: 13, fontWeight: '700' },
  verBtn:      { backgroundColor: 'rgba(59,130,246,0.1)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  verBtnCerrado: { backgroundColor: 'rgba(100,116,139,0.1)', borderColor: 'rgba(100,116,139,0.2)' },
  verBtnText:  { color: '#60a5fa', fontSize: 13, fontWeight: '700' },

  // ── Nueva consulta ──
  ncInfo:      { flexDirection: 'row', gap: 10, backgroundColor: 'rgba(59,130,246,0.08)', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(59,130,246,0.15)' },
  ncInfoIcon:  { fontSize: 18 },
  ncInfoText:  { color: '#93c5fd', fontSize: 13, lineHeight: 18, flex: 1 },
  ncField:     { gap: 6 },
  ncLabel:     { color: '#e2e8f4', fontSize: 13, fontWeight: '600' },
  ncInput:     { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#e2e8f4', fontSize: 14 },
  ncInputMulti:{ height: 140, paddingTop: 12 },
  ncCounter:   { color: '#3a4558', fontSize: 11, textAlign: 'right' },
  ncBtn:       { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  ncBtnText:   { color: '#fff', fontSize: 14, fontWeight: '700' },

  // ── Chat header ──
  chatHeader:       { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0b0f1a', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 4 },
  backBtn:          { padding: 8 },
  backArrow:        { color: '#3b82f6', fontSize: 22, fontWeight: '600' },
  chatHeaderInfo:   { flex: 1, flexDirection: 'row', alignItems: 'center' },
  chatHeaderNombre: { color: '#e2e8f4', fontSize: 15, fontWeight: '700' },
  chatHeaderEstado: { color: '#64748b', fontSize: 11.5, marginTop: 1 },
  infoBtn:          { padding: 8 },
  infoBtnIcon:      { fontSize: 20 },
  finalizarBtn:     { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  finalizarBtnText: { color: '#f87171', fontSize: 12, fontWeight: '700' },

  // ── Banner cerrada ──
  cerradaBanner:     { backgroundColor: 'rgba(100,116,139,0.1)', borderBottomWidth: 1, borderBottomColor: 'rgba(100,116,139,0.2)', paddingVertical: 8, paddingHorizontal: 16 },
  cerradaBannerText: { color: '#64748b', fontSize: 12, textAlign: 'center' },

  // ── Mensajes ──
  msgList:          { paddingHorizontal: 12, paddingVertical: 16, gap: 4 },
  fechaDivider:     { alignItems: 'center', marginVertical: 12 },
  fechaDividerText: { backgroundColor: 'rgba(255,255,255,0.06)', color: '#64748b', fontSize: 11, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  msgRow:           { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 2, gap: 6 },
  msgRowPropio:     { justifyContent: 'flex-end' },
  msgRowAjeno:      { justifyContent: 'flex-start' },
  burbuja:          { maxWidth: SCREEN_W * 0.72, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  burbujaPropia:        { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  burbujaAjena:         { backgroundColor: '#151d2e', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderBottomLeftRadius: 4 },
  burbujaTexto:         { fontSize: 14.5, lineHeight: 20 },
  burbujaTextoPropio:   { color: '#fff' },
  burbujaTextoAjeno:    { color: '#d4d8e8' },
  msgMeta:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, justifyContent: 'flex-end' },
  msgHora:  { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  msgTick:  { fontSize: 10, color: 'rgba(255,255,255,0.5)' },

  // ── Input ──
  inputArea: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 10, backgroundColor: '#0b0f1a', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  msgInput:  { flex: 1, backgroundColor: '#151d2e', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 10, color: '#e2e8f4', fontSize: 14, maxHeight: 120, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  inputCerrado:     { flex: 1, paddingVertical: 12, alignItems: 'center' },
  inputCerradoText: { color: '#3a4558', fontSize: 13 },
  sendBtn:         { width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  sendBtnDisabled: { backgroundColor: '#1e293b' },
  sendIcon:        { color: '#fff', fontSize: 16, marginLeft: 2 },

  // ── Lista directos ──
  searchWrap:  { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: { backgroundColor: '#0f1520', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#e2e8f4', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)' },
  conversaItem:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  conversaInfo:        { flex: 1, minWidth: 0 },
  conversaTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  conversaNombre:      { color: '#e2e8f4', fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  conversaHora:        { color: '#64748b', fontSize: 11 },
  conversaBottom:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conversaPreview:     { color: '#64748b', fontSize: 13, flex: 1, marginRight: 8 },
  conversaPreviewBold: { color: '#94a3b8', fontWeight: '600' },
  badge:     { backgroundColor: '#3b82f6', borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  separator: { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginLeft: 16 },

  // ── Perfil modal ──
  perfilModal:        { flex: 1, backgroundColor: '#06090f' },
  perfilHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  perfilHeaderTitle:  { color: '#e2e8f4', fontSize: 16, fontWeight: '700' },
  perfilHero:         { alignItems: 'center', paddingVertical: 32, gap: 10 },
  perfilNombre:       { color: '#e2e8f4', fontSize: 22, fontWeight: '800', marginTop: 8 },
  perfilRolBadge:     { backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' },
  perfilRolText:      { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  estadoBadge2:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  estadoActivo:       { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' },
  estadoInactivo:     { backgroundColor: 'rgba(100,116,139,0.1)', borderColor: 'rgba(100,116,139,0.2)' },
  estadoDot:          { width: 7, height: 7, borderRadius: 4 },
  estadoText:         { fontSize: 12, fontWeight: '600' },
  perfilSection:      { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },
  perfilSectionTitle: { color: '#3a4558', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'monospace', marginBottom: 12, marginTop: 8 },
  perfilRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  perfilRowIcon:      { fontSize: 20, marginTop: 2 },
  perfilRowLabel:     { color: '#64748b', fontSize: 11, marginBottom: 3 },
  perfilRowVal:       { color: '#e2e8f4', fontSize: 14, fontWeight: '500' },
  perfilBioBox:       { backgroundColor: '#0f1520', borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  perfilBioText:      { color: '#94a3b8', fontSize: 14, lineHeight: 22 },
});