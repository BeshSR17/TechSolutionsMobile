import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getSession } from '../services/auth';
import { getPerfil } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfil = async (userSession) => {
    if (userSession?.user) {
      try {
        const p = await getPerfil(userSession.user.id);
        setPerfil(p);
      } catch (error) {
        console.error("Error cargando perfil:", error.message);
        // Si el token no sirve, forzamos cerrar sesión
        setPerfil(null);
        setSession(null); 
        await supabase.auth.signOut(); // Esto limpia el token corrupto
      }
    } else {
      setPerfil(null);
    }
  };

  const recargarPerfil = async () => {
    const s = await getSession();
    if (s?.user) {
      try {
        const p = await getPerfil(s.user.id);
        setPerfil(p);
      } catch {}
    }
  };

  useEffect(() => {
    // 1. Carga inicial
    const inicializar = async () => {
      try {
        const s = await getSession();
        setSession(s);
        await cargarPerfil(s);
      } catch (e) {
        console.log("Error inicial:", e);
      } finally {
        setLoading(false);
      }
    };

    inicializar();

    // 2. Escuchar cambios (Login/Logout)
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await cargarPerfil(s);
      setLoading(false);
    });

    return () => {
      if (listener?.subscription) {
        listener.subscription.unsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, perfil, loading, recargarPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);