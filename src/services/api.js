// services/api.js
import { getSession } from './auth';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

async function authFetch(endpoint, options = {}) {
  const method = options.method || 'GET';

  try {
    const session = await getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error('Sesión expirada o inválida');
    }

    const res = await fetch(`${BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!res.ok) {
      let mensajeError = `Error ${res.status}`;
      const bodyText = await res.text();
      try {
        const bodyJson = JSON.parse(bodyText);
        mensajeError = bodyJson.error || mensajeError;
      } catch {
        console.log('⚠️ [API] Respuesta no-JSON:', bodyText);
      }
      throw new Error(mensajeError);
    }

    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    return { status: 'success' };

  } catch (error) {
    if (error.message.includes('Network request failed')) {
      throw new Error('No se pudo conectar con el servidor. Revisa tu internet.');
    }
    throw error;
  }
}

// ── Usuario ───────────────────────────────────────────────────────────────────
export const getMisTareas    = ()           => authFetch('/api/tareas/mis-tareas');
export const actualizarTarea = (id, datos)  =>
  authFetch(`/api/tareas/${id}`, { method: 'PUT', body: JSON.stringify(datos) });

// ── Admin — Tareas ────────────────────────────────────────────────────────────
export const getTodasTareas       = ()          => authFetch('/api/tareas');
export const crearTarea           = (datos)     =>
  authFetch('/api/tareas', { method: 'POST', body: JSON.stringify(datos) });
export const eliminarTarea        = (id)        =>
  authFetch(`/api/tareas/${id}`, { method: 'DELETE' });
export const actualizarTareaAdmin = (id, datos) =>
  authFetch(`/api/tareas/${id}`, { method: 'PUT', body: JSON.stringify(datos) });

// ── Admin — Extras ────────────────────────────────────────────────────────────
export const getExtras = (tareaId) =>
  authFetch(`/api/tareas/${tareaId}/extras`);

// ── Admin — Clientes ──────────────────────────────────────────────────────────
export const getClientes       = ()           => authFetch('/api/clientes');
export const crearCliente      = (datos)      =>
  authFetch('/api/clientes', { method: 'POST', body: JSON.stringify(datos) });
export const actualizarCliente = (id, datos)  =>
  authFetch(`/api/clientes/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
export const eliminarCliente   = (id)         =>
  authFetch(`/api/clientes/${id}`, { method: 'DELETE' });

// ── Admin — Proyectos ─────────────────────────────────────────────────────────
export const getProyectos       = ()           => authFetch('/api/proyectos');
export const crearProyecto      = (datos)      =>
  authFetch('/api/proyectos', { method: 'POST', body: JSON.stringify(datos) });
export const actualizarProyecto = (id, datos)  =>
  authFetch(`/api/proyectos/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
export const eliminarProyecto   = (id)         =>
  authFetch(`/api/proyectos/${id}`, { method: 'DELETE' });

// ── Admin — General ───────────────────────────────────────────────────────────
export const getTodas    = () => authFetch('/api/tareas');
export const getPerfiles = () => authFetch('/api/perfiles');
export const getUsuarios = () => authFetch('/api/usuarios');

// ── Perfil ────────────────────────────────────────────────────────────────────
export const getPerfil        = (id)        => authFetch(`/api/perfiles/${id}`);
export const actualizarPerfil = (id, datos) =>
  authFetch(`/api/perfiles/${id}`, { method: 'PUT', body: JSON.stringify(datos) });