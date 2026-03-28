// screens/ChatScreen.js
// Chat estilo WhatsApp — dual mode:
//   • Admin → lista de todos los usuarios + chat individual
//   • Usuario → chat directo con el admin (como AyudaView)
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, Image,
  ActivityIndicator, Modal, ScrollView, Dimensions, Keyboard,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { getPerfiles } from '../services/api';

// ── ID del admin — misma variable que en la web ───────────────────────────────
// Ponlo en tu .env como EXPO_PUBLIC_ADMIN_ID=xxxxx-xxxx-...
const ADMIN_ID = process.env.EXPO_PUBLIC_ADMIN_ID || null;

const { width: SCREEN_W } = Dimensions.get('window');

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatHora = (f) =>
  f ? new Date(f).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '';

const formatFechaCorta = (f) => {
  if (!f) return '';
  const d    = new Date(f);
  const hoy  = new Date();
  const ayer = new Date(hoy); ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString())  return formatHora(f);
  if (d.toDateString() === ayer.toDateString()) return 'Ayer';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
};

// ── Avatar ────────────────────────────────────────────────────────────────────
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

// ── Perfil del contacto (Modal) ───────────────────────────────────────────────
const PerfilContacto = ({ contacto, onCerrar }) => {
  const esAdmin = contacto.rol === 'Administrador' || contacto.rol === 'Admin';
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
              <Text style={[s.perfilRolText, esAdmin && { color: '#8b5cf6' }]}>
                {esAdmin ? '👑 Administrador' : '👤 Colaborador'}
              </Text>
            </View>
            <View style={[s.estadoBadge, contacto.estado === 'Activo' ? s.estadoActivo : s.estadoInactivo]}>
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

// ── Chat individual (reutilizable para admin y usuario) ───────────────────────
const ChatIndividual = ({ miId, contacto, onVolver, modoUsuario = false }) => {
  const [mensajes,  setMensajes]  = useState([]);
  const [texto,     setTexto]     = useState('');
  const [cargando,  setCargando]  = useState(true);
  const [enviando,  setEnviando]  = useState(false);
  const [verPerfil, setVerPerfil] = useState(false);
  const flatRef = useRef(null);
  const insets  = useSafeAreaInsets();

  // Cargar historial + marcar leídos
  useEffect(() => {
    if (!miId || !contacto?.id) return;
    const cargar = async () => {
      setCargando(true);
      const { data } = await supabase
        .from('mensajes')
        .select('*')
        .or(
          `and(remitente_id.eq.${miId},destinatario_id.eq.${contacto.id}),` +
          `and(remitente_id.eq.${contacto.id},destinatario_id.eq.${miId})`
        )
        .order('creado_en', { ascending: true });
      setMensajes(data || []);
      setCargando(false);

      // Marcar como leídos los mensajes entrantes
      await supabase
        .from('mensajes')
        .update({ leido: true })
        .eq('remitente_id', contacto.id)
        .eq('destinatario_id', miId)
        .or('leido.eq.false,leido.is.null');
    };
    cargar();
  }, [miId, contacto?.id]);

  // Realtime — escuchar mensajes nuevos del contacto
  useEffect(() => {
    if (!miId || !contacto?.id) return;
    const canalId = `chat-${[miId, contacto.id].sort().join('-')}`;
    const canal = supabase
      .channel(canalId)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes',
        filter: `destinatario_id=eq.${miId}`,
      }, (payload) => {
        if (payload.new.remitente_id === contacto.id) {
          setMensajes(prev => [...prev, payload.new]);
          supabase.from('mensajes').update({ leido: true }).eq('id', payload.new.id);
        }
      })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [miId, contacto?.id]);

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (mensajes.length > 0 && flatRef.current) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [mensajes]);

  const handleEnviar = async () => {
    if (!texto.trim() || enviando) return;
    const contenido = texto.trim();
    setTexto('');
    Keyboard.dismiss();

    // Optimistic update
    const optimista = {
      id: `tmp-${Date.now()}`,
      remitente_id: miId,
      destinatario_id: contacto.id,
      contenido,
      creado_en: new Date().toISOString(),
      _optimista: true,
    };
    setMensajes(prev => [...prev, optimista]);
    setEnviando(true);

    try {
      const { data } = await supabase
        .from('mensajes')
        .insert({ remitente_id: miId, destinatario_id: contacto.id, contenido })
        .select()
        .single();
      setMensajes(prev => prev.map(m => m.id === optimista.id ? (data || m) : m));
    } catch {
      // Revertir si falla
      setMensajes(prev => prev.filter(m => m.id !== optimista.id));
    } finally {
      setEnviando(false);
    }
  };

  // Agrupar por fecha
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
        {!esPropio && (
          <Avatar url={contacto.avatar_url} nombre={contacto.nombre} size={28} />
        )}
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'android' ? 25 : 0}
    >
      {/* Header */}
      <View style={s.chatHeader}>
        {onVolver ? (
          <TouchableOpacity onPress={onVolver} style={s.backBtn}>
            <Text style={s.backArrow}>←</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}

        <TouchableOpacity style={s.chatHeaderInfo} onPress={() => setVerPerfil(true)}>
          <Avatar url={contacto.avatar_url} nombre={contacto.nombre}
            size={38} showOnline isOnline={contacto.estado === 'Activo'} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={s.chatHeaderNombre} numberOfLines={1}>
              {contacto.nombre || 'Administrador'}
            </Text>
            <Text style={[s.chatHeaderEstado, contacto.estado === 'Activo' && { color: '#10b981' }]}>
              {contacto.estado === 'Activo' ? '● En línea' : '○ Desconectado'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={s.infoBtn} onPress={() => setVerPerfil(true)}>
          <Text style={s.infoBtnIcon}>ℹ️</Text>
        </TouchableOpacity>
      </View>

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
          ListEmptyComponent={
            <View style={s.centered}>
              <Text style={{ fontSize: 44, marginBottom: 8 }}>👋</Text>
              <Text style={s.emptyText}>
                {modoUsuario
                  ? '¡Escríbele al administrador!'
                  : '¡Inicia la conversación!'
                }
              </Text>
            </View>
          }
        />
      )}

      {/* Input */}
      <View style={[s.inputArea, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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

      {/* Perfil del contacto */}
      {verPerfil && (
        <PerfilContacto contacto={contacto} onCerrar={() => setVerPerfil(false)} />
      )}
    </KeyboardAvoidingView>
  );
};

// ── Lista de conversaciones (solo para admin) ─────────────────────────────────
const ConversacionesList = ({ miId, onSeleccionar }) => {
  const [usuarios,  setUsuarios]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [busqueda,  setBusqueda]  = useState('');
  const [noLeidos,  setNoLeidos]  = useState({});
  const [ultimoMsg, setUltimoMsg] = useState({});

  // Carga todos los perfiles (el admin tiene acceso a esta ruta)
  useEffect(() => {
    const cargar = async () => {
      try {
        const data = await getPerfiles();
        setUsuarios((data || []).filter(u => u.id !== miId));
      } catch {
        /* silencioso */
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [miId]);

  // Último mensaje + no leídos por usuario
  useEffect(() => {
    if (!miId || usuarios.length === 0) return;
    const cargarResumenes = async () => {
      const nl = {}, um = {};
      await Promise.all(usuarios.map(async (u) => {
        const { data: msgs } = await supabase
          .from('mensajes')
          .select('contenido, creado_en, remitente_id')
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
          .eq('remitente_id', u.id)
          .eq('destinatario_id', miId)
          .eq('leido', false);
        if (count) nl[u.id] = count;
      }));
      setUltimoMsg(um);
      setNoLeidos(nl);
    };
    cargarResumenes();
  }, [miId, usuarios]);

  // Realtime — actualizar lista con mensajes nuevos
  useEffect(() => {
    if (!miId) return;
    const canal = supabase
      .channel('admin-chat-lista')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mensajes',
        filter: `destinatario_id=eq.${miId}`,
      }, (payload) => {
        const { remitente_id, contenido, creado_en } = payload.new;
        setUltimoMsg(prev => ({ ...prev, [remitente_id]: { contenido, creado_en, remitente_id } }));
        setNoLeidos(prev => ({ ...prev, [remitente_id]: (prev[remitente_id] || 0) + 1 }));
      })
      .subscribe();
    return () => supabase.removeChannel(canal);
  }, [miId]);

  const ordenados = [...usuarios].sort((a, b) => {
    const tA = ultimoMsg[a.id]?.creado_en || '';
    const tB = ultimoMsg[b.id]?.creado_en || '';
    return tB.localeCompare(tA);
  });

  const filtrados = ordenados.filter(u =>
    u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.email?.toLowerCase().includes(busqueda.toLowerCase())
  );

  const renderItem = ({ item }) => {
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
                : 'Sin mensajes aún'
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
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.searchWrap}>
        <TextInput
          style={s.searchInput}
          placeholder="Buscar conversación..."
          placeholderTextColor="#3a4558"
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>
      {loading ? (
        <View style={s.centered}>
          <ActivityIndicator color="#3b82f6" size="large" />
        </View>
      ) : filtrados.length === 0 ? (
        <View style={s.centered}>
          <Text style={{ fontSize: 40 }}>💬</Text>
          <Text style={s.emptyText}>No hay conversaciones aún.</Text>
        </View>
      ) : (
        <FlatList
          data={filtrados}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={s.separator} />}
        />
      )}
    </View>
  );
};

// ── Vista de usuario: chat directo con el admin ───────────────────────────────
const ChatConAdmin = ({ miId }) => {
  const [adminPerfil, setAdminPerfil] = useState(null);
  const [loading,     setLoading]     = useState(true);

  useEffect(() => {
    const cargarAdmin = async () => {
      if (!ADMIN_ID) {
        // Fallback: buscar el primer admin en la tabla perfiles
        const { data } = await supabase
          .from('perfiles')
          .select('*')
          .in('rol', ['Administrador', 'Admin'])
          .limit(1)
          .single();
        setAdminPerfil(data || {
          id: ADMIN_ID,
          nombre: 'Administrador',
          rol: 'Administrador',
          estado: 'Activo',
          avatar_url: null,
        });
      } else {
        // Cargar perfil del admin por su ID
        const { data } = await supabase
          .from('perfiles')
          .select('*')
          .eq('id', ADMIN_ID)
          .single();
        setAdminPerfil(data || {
          id: ADMIN_ID,
          nombre: 'Administrador',
          rol: 'Administrador',
          estado: 'Activo',
          avatar_url: null,
        });
      }
      setLoading(false);
    };
    cargarAdmin();
  }, []);

  if (loading) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color="#3b82f6" />
        <Text style={s.emptyText}>Conectando con el administrador...</Text>
      </View>
    );
  }

  if (!adminPerfil) {
    return (
      <View style={s.centered}>
        <Text style={{ fontSize: 36 }}>⚠️</Text>
        <Text style={s.emptyText}>No se pudo conectar con el administrador.</Text>
      </View>
    );
  }

  return (
    <ChatIndividual
      miId={miId}
      contacto={adminPerfil}
      onVolver={null}        // no hay volver en modo usuario
      modoUsuario
    />
  );
};

// ── Pantalla principal ────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { session, perfil } = useAuth();
  const miId = session?.user?.id;

  const esAdmin = perfil?.rol === 'Administrador' || perfil?.rol === 'Admin';

  // Estado para la vista del admin
  const [vista,    setVista]    = useState('lista'); // 'lista' | 'chat'
  const [contacto, setContacto] = useState(null);

  if (!miId) {
    return (
      <View style={s.centered}>
        <ActivityIndicator color="#3b82f6" />
      </View>
    );
  }

  // ── Modo usuario: chat directo con admin ───────────────────────────────────
  if (!esAdmin) {
    return (
      <SafeAreaView style={s.safe} edges={[]}>
        
        <ChatConAdmin miId={miId} />
      </SafeAreaView>
    );
  }

  // ── Modo admin: lista de conversaciones ────────────────────────────────────
  return (
    <SafeAreaView style={s.safe} edges={[]}>
      {vista === 'lista' ? (
        <>
          <View style={s.listaHeader}>
            <Text style={s.listaHeaderTitle}>Mensajes</Text>
          </View>
          <ConversacionesList
            miId={miId}
            onSeleccionar={(u) => { setContacto(u); setVista('chat'); }}
          />
        </>
      ) : (
        <ChatIndividual
          miId={miId}
          contacto={contacto}
          onVolver={() => setVista('lista')}
        />
      )}
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: '#06090f' },
  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 40 },
  emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },

  listaHeader: {
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  listaHeaderTitle: { color: '#e2e8f4', fontSize: 22, fontWeight: '800' },
  listaHeaderSub:   { color: '#64748b', fontSize: 12, marginTop: 2 },

  // Búsqueda
  searchWrap:  { paddingHorizontal: 16, paddingVertical: 10 },
  searchInput: {
    backgroundColor: '#0f1520', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    color: '#e2e8f4', fontSize: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },

  // Lista de conversaciones
  conversaItem:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  conversaInfo:        { flex: 1, minWidth: 0 },
  conversaTop:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  conversaNombre:      { color: '#e2e8f4', fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  conversaHora:        { color: '#64748b', fontSize: 11 },
  conversaBottom:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  conversaPreview:     { color: '#64748b', fontSize: 13, flex: 1, marginRight: 8 },
  conversaPreviewBold: { color: '#94a3b8', fontWeight: '600' },
  badge:               { backgroundColor: '#3b82f6', borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  badgeText:           { color: '#fff', fontSize: 11, fontWeight: '700' },
  separator:           { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginLeft: 78 },

  // Chat header
  chatHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#0b0f1a', paddingHorizontal: 8, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 4,
  },
  backBtn:          { padding: 8 },
  backArrow:        { color: '#3b82f6', fontSize: 22, fontWeight: '600' },
  chatHeaderInfo:   { flex: 1, flexDirection: 'row', alignItems: 'center' },
  chatHeaderNombre: { color: '#e2e8f4', fontSize: 15, fontWeight: '700' },
  chatHeaderEstado: { color: '#64748b', fontSize: 11.5, marginTop: 1 },
  infoBtn:          { padding: 8 },
  infoBtnIcon:      { fontSize: 20 },

  // Mensajes
  msgList:       { paddingHorizontal: 12, paddingVertical: 16, gap: 4 },
  fechaDivider:  { alignItems: 'center', marginVertical: 12 },
  fechaDividerText: {
    backgroundColor: 'rgba(255,255,255,0.06)', color: '#64748b', fontSize: 11,
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden',
  },
  msgRow:      { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 2, gap: 6 },
  msgRowPropio:{ justifyContent: 'flex-end' },
  msgRowAjeno: { justifyContent: 'flex-start' },
  burbuja:     { maxWidth: SCREEN_W * 0.72, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  burbujaPropia:       { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  burbujaAjena:        { backgroundColor: '#151d2e', borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', borderBottomLeftRadius: 4 },
  burbujaTexto:        { fontSize: 14.5, lineHeight: 20 },
  burbujaTextoPropio:  { color: '#fff' },
  burbujaTextoAjeno:   { color: '#d4d8e8' },
  msgMeta:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3, justifyContent: 'flex-end' },
  msgHora:  { color: 'rgba(255,255,255,0.3)', fontSize: 10 },
  msgTick:  { fontSize: 10, color: 'rgba(255,255,255,0.5)' },

  // Input
  inputArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: '#0b0f1a',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  msgInput: {
    flex: 1, backgroundColor: '#151d2e', borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 10,
    color: '#e2e8f4', fontSize: 14, maxHeight: 120,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2563eb', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
  },
  sendBtnDisabled: { backgroundColor: '#1e293b', shadowOpacity: 0 },
  sendIcon:        { color: '#fff', fontSize: 16, marginLeft: 2 },

  // Perfil modal
  perfilModal:       { flex: 1, backgroundColor: '#06090f' },
  perfilHeader:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  perfilHeaderTitle: { color: '#e2e8f4', fontSize: 16, fontWeight: '700' },
  perfilHero:        { alignItems: 'center', paddingVertical: 32, gap: 10 },
  perfilNombre:      { color: '#e2e8f4', fontSize: 22, fontWeight: '800', marginTop: 8 },
  perfilRolBadge:    { backgroundColor: 'rgba(59,130,246,0.1)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(59,130,246,0.2)' },
  perfilRolText:     { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  estadoBadge:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  estadoActivo:      { backgroundColor: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.2)' },
  estadoInactivo:    { backgroundColor: 'rgba(100,116,139,0.1)', borderColor: 'rgba(100,116,139,0.2)' },
  estadoDot:         { width: 7, height: 7, borderRadius: 4 },
  estadoText:        { fontSize: 12, fontWeight: '600' },
  perfilSection:     { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },
  perfilSectionTitle:{ color: '#3a4558', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'monospace', marginBottom: 12, marginTop: 8 },
  perfilRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  perfilRowIcon:     { fontSize: 20, marginTop: 2 },
  perfilRowLabel:    { color: '#64748b', fontSize: 11, marginBottom: 3 },
  perfilRowVal:      { color: '#e2e8f4', fontSize: 14, fontWeight: '500' },
  perfilBioBox:      { backgroundColor: '#0f1520', borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  perfilBioText:     { color: '#94a3b8', fontSize: 14, lineHeight: 22 },
});