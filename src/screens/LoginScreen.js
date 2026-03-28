import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
  KeyboardAvoidingView, Platform, ScrollView,
  StatusBar, Animated,
} from 'react-native';
import { supabase } from '../services/auth';

const LOGO_URL = 'https://ycyncrhqawrtgjknstxd.supabase.co/storage/v1/object/public/config/logo.png';

export default function LoginScreen() {
  const [tab, setTab]           = useState('login');   // 'login' | 'register' | 'reset'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [msg, setMsg]           = useState({ text: '', type: '' }); // type: 'error'|'success'|'warning'

  const showMsg = (text, type = 'error') => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: '', type: '' }), 4000);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!email || !password) return showMsg('Completa todos los campos.', 'warning');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        showMsg('Credenciales incorrectas. Verifica tu correo y contraseña.');
      } else if (error.message.includes('Email not confirmed')) {
        showMsg('Confirma tu correo antes de iniciar sesión.', 'warning');
      } else {
        showMsg('Error: ' + error.message);
      }
    }
    
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!nombre || !email || !password) return showMsg('Completa todos los campos.', 'warning');
    if (password.length < 6) return showMsg('La contraseña debe tener mínimo 6 caracteres.', 'warning');
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { nombre } },
    });
    if (error) {
      if (error.message.includes('already registered')) {
        showMsg('Este correo ya está registrado.', 'warning');
      } else {
        showMsg('Error: ' + error.message);
      }
    } else {
      showMsg('¡Cuenta creada! Revisa tu correo para validarla.', 'success');
      setTab('login');
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!email) return showMsg('Ingresa tu correo.', 'warning');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      showMsg('Error: ' + error.message);
    } else {
      showMsg('Si el correo está registrado, recibirás un enlace.', 'success');
      setTab('login');
    }
    setLoading(false);
  };

  // ── UI Helpers ─────────────────────────────────────────────────────────────

  const msgColor = {
    error:   '#f87171',
    success: '#34d399',
    warning: '#fbbf24',
  }[msg.type] || '#f87171';

  return (
    <KeyboardAvoidingView
      style={styles.scene}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar barStyle="light-content" backgroundColor="#06090f" />

      {/* Decoración de fondo — círculos de "glow" */}
      <View style={styles.glowTop} pointerEvents="none" />
      <View style={styles.glowBottom} pointerEvents="none" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>

          {/* Logo */}
          <Image source={{ uri: LOGO_URL }} style={styles.logo} resizeMode="contain" />

          {/* Mensaje toast inline */}
          {msg.text ? (
            <View style={[styles.msgBox, { borderColor: msgColor }]}>
              <Text style={[styles.msgText, { color: msgColor }]}>{msg.text}</Text>
            </View>
          ) : null}

          {/* ── Tabs (solo en login/register) ── */}
          {tab !== 'reset' && (
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, tab === 'login' && styles.tabActive]}
                onPress={() => { setTab('login'); setMsg({ text: '', type: '' }); }}
              >
                <Text style={[styles.tabText, tab === 'login' && styles.tabTextActive]}>
                  Iniciar sesión
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === 'register' && styles.tabActive]}
                onPress={() => { setTab('register'); setMsg({ text: '', type: '' }); }}
              >
                <Text style={[styles.tabText, tab === 'register' && styles.tabTextActive]}>
                  Registrarse
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── LOGIN ── */}
          {tab === 'login' && (
            <View style={styles.form}>
              <Field label="Correo corporativo">
                <TextInput
                  style={styles.input}
                  placeholder="tu@empresa.com"
                  placeholderTextColor="#334155"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </Field>
              <Field label="Contraseña">
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#334155"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </Field>

              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnPrimaryText}>Iniciar sesión</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity onPress={() => { setTab('reset'); setMsg({ text: '', type: '' }); }}>
                <Text style={styles.link}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── REGISTRO ── */}
          {tab === 'register' && (
            <View style={styles.form}>
              <Field label="Nombre completo">
                <TextInput
                  style={styles.input}
                  placeholder="Tu nombre"
                  placeholderTextColor="#334155"
                  value={nombre}
                  onChangeText={setNombre}
                />
              </Field>
              <Field label="Correo corporativo">
                <TextInput
                  style={styles.input}
                  placeholder="tu@empresa.com"
                  placeholderTextColor="#334155"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </Field>
              <Field label="Contraseña">
                <TextInput
                  style={styles.input}
                  placeholder="Mínimo 6 caracteres"
                  placeholderTextColor="#334155"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                />
              </Field>

              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnPrimaryText}>Crear cuenta</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* ── RESET PASSWORD ── */}
          {tab === 'reset' && (
            <View style={styles.form}>
              <Text style={styles.resetTitle}>Restablecer contraseña</Text>
              <Text style={styles.resetSubtitle}>
                Te enviaremos un enlace a tu correo registrado.
              </Text>

              <Field label="Correo corporativo">
                <TextInput
                  style={styles.input}
                  placeholder="tu@empresa.com"
                  placeholderTextColor="#334155"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </Field>

              <TouchableOpacity
                style={[styles.btnPrimary, loading && styles.btnDisabled]}
                onPress={handleReset}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.btnPrimaryText}>Enviar enlace</Text>
                }
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnGhost}
                onPress={() => { setTab('login'); setMsg({ text: '', type: '' }); }}
              >
                <Text style={styles.btnGhostText}>← Volver al inicio de sesión</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Componente Field reutilizable ──────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

// ── Estilos ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scene: {
    flex: 1,
    backgroundColor: '#06090f',
  },

  // Decoración de fondo
  glowTop: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(59,130,246,0.08)',
    top: -150,
    alignSelf: 'center',
  },
  glowBottom: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(139,92,246,0.06)',
    bottom: -100,
    right: -80,
  },

  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    paddingVertical: 48,
  },

  // Card principal
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(15,21,32,0.95)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 28,
    paddingBottom: 32,
  },

  // Logo
  logo: {
    width: 150,
    height: 52,
    alignSelf: 'center',
    marginBottom: 24,
  },

  // Toast inline
  msgBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  msgText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.25)',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#60a5fa',
  },

  // Form
  form: {
    gap: 14,
    flexDirection: 'column',
  },
  field: {
    gap: 6,
    marginBottom: 2,
  },
  label: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#e2e8f4',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e2e8f4',
    fontSize: 14,
  },

  // Botón primario
  btnPrimary: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Botón ghost
  btnGhost: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginTop: 4,
  },
  btnGhostText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '600',
  },

  // Link
  link: {
    color: 'rgba(96,165,250,0.8)',
    fontSize: 12.5,
    textAlign: 'center',
    marginTop: 4,
  },

  // Reset
  resetTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#e2e8f4',
    textAlign: 'center',
    marginBottom: 6,
  },
  resetSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 18,
  },
});