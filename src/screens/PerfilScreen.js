// screens/PerfilScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/auth';
import { getPerfil, actualizarPerfil } from '../services/api';
import { validar, esValido, REGLAS } from '../hooks/useValidacion';
import { Buffer } from 'buffer';

// ── Campo con error inline ────────────────────────────────────────────────────
const Campo = ({ label, error, optional, children, charCount }) => (
  <View style={s.field}>
    <Text style={s.label}>
      {label}{optional && <Text style={s.optional}> (opcional)</Text>}
    </Text>
    {children}
    <View style={s.fieldFooter}>
      {error
        ? <Text style={s.errorMsg}>{error}</Text>
        : <View />
      }
      {charCount !== undefined && (
        <Text style={s.charCount}>{charCount}/500</Text>
      )}
    </View>
  </View>
);

export default function PerfilScreen() {
  const { session, recargarPerfil } = useAuth();
  const userId = session?.user?.id;

  const [loading,     setLoading]     = useState(false);
  const [guardado,    setGuardado]    = useState(false);
  const [avatarUrl,   setAvatarUrl]   = useState(null);
  const [nombre,      setNombre]      = useState(session?.user?.user_metadata?.nombre || '');
  const [biografia,   setBiografia]   = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [idVisual,    setIdVisual]    = useState(null);
  const [errores,     setErrores]     = useState({});
  
  // ── Cargar perfil ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    const cargar = async () => {
      try {
        const data = await getPerfil(userId);
        setBiografia(data.biografia || '');
        setAvatarUrl(data.avatar_url || null);
        setIdVisual(data.id_visual ? String(data.id_visual) : null);
        if (data.nombre) setNombre(data.nombre);
      } catch {
        Alert.alert('Error', 'No se pudo cargar el perfil');
      }
    };
    cargar();
  }, [userId]);

  // ── Limpiar error de un campo al escribir ──────────────────────────────────
  const limpiar = (...campos) =>
    setErrores(prev => {
      const next = { ...prev };
      campos.forEach(c => delete next[c]);
      return next;
    });

  // ── Guardar cambios ────────────────────────────────────────────────────────
  const handleGuardar = async () => {
    const esquema = {
      nombre:   [REGLAS.requerido, REGLAS.minLength(2), REGLAS.maxLength(80)],
      biografia:[REGLAS.maxLength(500)],
    };
    if (newPassword) {
      esquema.newPassword = [REGLAS.requerido, REGLAS.minLength(6)];
      esquema.confirmPass = [REGLAS.requerido, REGLAS.passwordIgual(newPassword)];
    }

    const errs = validar({ nombre, biografia, newPassword, confirmPass }, esquema);
    setErrores(errs);
    if (!esValido(errs)) return;

    setLoading(true);
    try {
      
      await actualizarPerfil(userId, { biografia, nombre });

      if (newPassword) {
        const { error: passError } = await supabase.auth.updateUser({ password: newPassword });
        if (passError) throw passError;
        setNewPassword('');
        setConfirmPass('');
      }

      setErrores({});
      setGuardado(true);
      await recargarPerfil();
      setTimeout(() => setGuardado(false), 3000);
      Alert.alert('✅ Éxito', 'Perfil actualizado correctamente');
    } catch (err) {
      Alert.alert('Error al guardar', err.message || 'Hubo un problema de conexión.');
    } finally {
      setLoading(false);
    }
  };

  // ── Subir foto ─────────────────────────────────────────────────────────────
  const handleCambiarFoto = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permiso denegado', 'Se necesita acceso a la galería para cambiar la foto.');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    base64: true, 
  });

  if (result.canceled) return;

  setLoading(true);

  try {
    const asset = result.assets[0];

    const ext = asset.uri.split('.').pop() || 'jpg';
    const fileName = `${userId}.${ext}`;
    const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

    // Convertir base64 → Blob válido
    const base64Data = asset.base64;
    const blob = Buffer.from(base64Data, 'base64');

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, blob, {
        contentType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const urlConCache = `${data.publicUrl}?t=${Date.now()}`;

    await actualizarPerfil(userId, { avatar_url: urlConCache });
    setAvatarUrl(urlConCache);
    await recargarPerfil();
    Alert.alert('✅', 'Foto de perfil actualizada');
  } catch (err) {
    Alert.alert('Error', 'No se pudo subir la foto: ' + err.message);
  } finally {
    setLoading(false);
  }
};


  const inicial = nombre ? nombre.charAt(0).toUpperCase() : '?';
  const ultimoAcceso = session?.user?.last_sign_in_at
    ? new Date(session.user.last_sign_in_at).toLocaleDateString('es', {
        day: 'numeric', month: 'short', year: 'numeric',
      })
    : '—';

  return (
    <SafeAreaView style={s.safe} edges={['bottom']}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Avatar ──────────────────────────────────────────────────────── */}
        <View style={s.avatarSection}>
          <View style={s.avatarWrap}>
            {avatarUrl
              ? <Image source={{ uri: avatarUrl }} style={s.avatarImg} />
              : <View style={s.avatarPlaceholder}><Text style={s.avatarInicial}>{inicial}</Text></View>
            }
            {loading && (
              <View style={s.avatarOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            )}
          </View>
          <TouchableOpacity style={s.btnFoto} onPress={handleCambiarFoto} disabled={loading}>
            <Text style={s.btnFotoText}>{loading ? 'Procesando...' : '📷  Cambiar foto'}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Info card ───────────────────────────────────────────────────── */}
        <View style={s.infoCard}>
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>EMAIL</Text>
            <Text style={s.infoVal}>{session?.user?.email || '—'}</Text>
          </View>
          <View style={s.infoRowDivider} />
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>ID DE COLABORADOR</Text>
            <Text style={[s.infoVal, s.mono]}>{idVisual || '—'}</Text>
          </View>
          <View style={s.infoRowDivider} />
          <View style={s.infoRow}>
            <Text style={s.infoLabel}>ÚLTIMO ACCESO</Text>
            <Text style={[s.infoVal, s.mono]}>{ultimoAcceso}</Text>
          </View>
        </View>

        {/* ── Datos personales ─────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>DATOS PERSONALES</Text>

          <Campo label="Nombre completo" error={errores.nombre}>
            <TextInput
              style={[s.input, errores.nombre && s.inputError]}
              placeholder="Tu nombre"
              placeholderTextColor="#3a4558"
              value={nombre}
              onChangeText={v => { setNombre(v); limpiar('nombre'); }}
            />
          </Campo>

          <Campo label="Biografía" error={errores.biografia} optional charCount={biografia.length}>
            <TextInput
              style={[s.input, s.textarea, errores.biografia && s.inputError]}
              placeholder="Cuéntanos sobre ti, tus habilidades o rol en el equipo..."
              placeholderTextColor="#3a4558"
              value={biografia}
              onChangeText={v => { setBiografia(v); limpiar('biografia'); }}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </Campo>
        </View>

        {/* ── Seguridad ────────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>SEGURIDAD</Text>

          <Campo label="Nueva contraseña" error={errores.newPassword} optional>
            <TextInput
              style={[s.input, errores.newPassword && s.inputError]}
              placeholder="Mínimo 6 caracteres"
              placeholderTextColor="#3a4558"
              value={newPassword}
              onChangeText={v => { setNewPassword(v); limpiar('newPassword', 'confirmPass'); }}
              secureTextEntry
            />
          </Campo>

          <Campo label="Confirmar contraseña" error={errores.confirmPass}>
            <TextInput
              style={[s.input, errores.confirmPass && s.inputError]}
              placeholder="Repite la nueva contraseña"
              placeholderTextColor="#3a4558"
              value={confirmPass}
              onChangeText={v => { setConfirmPass(v); limpiar('confirmPass'); }}
              secureTextEntry
            />
          </Campo>
        </View>

        {/* ── Botón guardar ────────────────────────────────────────────────── */}
        <View style={s.footer}>
          {guardado && <Text style={s.successMsg}>✅ Cambios guardados correctamente</Text>}
          <TouchableOpacity
            style={[s.btnPrimario, loading && { opacity: 0.5 }]}
            onPress={handleGuardar}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnPrimarioText}>Guardar cambios</Text>
            }
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:          { flex: 1, backgroundColor: '#06090f' },
  scroll:        { flex: 1 },
  scrollContent: { padding: 16 },

  avatarSection: { alignItems: 'center', gap: 14, marginBottom: 20, paddingTop: 8 },
  avatarWrap:    { position: 'relative', width: 110, height: 110 },
  avatarImg: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: 'rgba(59,130,246,0.5)',
  },
  avatarPlaceholder: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: '#1e3a5f', alignItems: 'center', justifyContent: 'center',
    borderWidth: 3, borderColor: 'rgba(59,130,246,0.3)',
  },
  avatarInicial: { fontSize: 42, fontWeight: '800', color: '#60a5fa' },
  avatarOverlay: {
    position: 'absolute', width: 110, height: 110,
    borderRadius: 55, backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnFoto: {
    backgroundColor: '#151d2e', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  btnFotoText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },

  infoCard: {
    backgroundColor: '#0f1520', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 16, marginBottom: 16,
  },
  infoRow:        { paddingVertical: 10, gap: 4 },
  infoRowDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  infoLabel:      { fontSize: 9, letterSpacing: 1.2, color: '#64748b', fontFamily: 'monospace' },
  infoVal:        { fontSize: 13, color: '#e2e8f4', fontWeight: '500' },
  mono:           { fontFamily: 'monospace', fontSize: 12 },

  section: {
    backgroundColor: '#0f1520', borderRadius: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: 20, marginBottom: 14, gap: 14,
  },
  sectionTitle: {
    fontSize: 9, letterSpacing: 1.5,
    color: '#64748b', fontFamily: 'monospace', marginBottom: 2,
  },

  field:       { gap: 5 },
  fieldFooter: { flexDirection: 'row', justifyContent: 'space-between', minHeight: 16 },
  label:       { fontSize: 13, fontWeight: '600', color: '#e2e8f4' },
  optional:    { fontSize: 11, color: '#64748b', fontWeight: '400' },
  input: {
    backgroundColor: '#151d2e', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    color: '#e2e8f4', fontSize: 13.5,
  },
  textarea:   { minHeight: 100, textAlignVertical: 'top' },
  inputError: { borderColor: 'rgba(239,68,68,0.5)' },
  errorMsg:   { fontSize: 11.5, color: '#ef4444', fontFamily: 'monospace', flex: 1 },
  charCount:  { fontSize: 10, color: '#3a4558', fontFamily: 'monospace' },

  footer:     { gap: 12, marginTop: 4 },
  successMsg: { fontSize: 13, color: '#10b981', fontWeight: '600', textAlign: 'center' },
  btnPrimario: {
    backgroundColor: '#3b82f6', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 6,
  },
  btnPrimarioText: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});