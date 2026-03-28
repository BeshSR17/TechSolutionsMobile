// context/AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getSession } from '../services/auth';
import { getPerfil } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil,  setPerfil]  = useState(null);
  const [loading, setLoading] = useState(true);

  const cargarPerfil = async (userSession) => {
    if (userSession?.user) {
      try {
        const p = await getPerfil(userSession.user.id);
        setPerfil(p);
      } catch (error) {
        console.error('Error cargando perfil:', error.message);
        setPerfil(null);
        setSession(null);
        await supabase.auth.signOut();
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
    const inicializar = async () => {
      try {
        const s = await getSession();
        setSession(s);
        await cargarPerfil(s);
      } catch (e) {
        
        const msg = e?.message || '';
        if (
          msg.includes('Refresh Token Not Found') ||
          msg.includes('Invalid Refresh Token')   ||
          msg.includes('refresh_token_not_found')
        ) {
          console.log('Token inválido al arrancar — limpiando sesión');
          await supabase.auth.signOut();
          setSession(null);
          setPerfil(null);
        } else {
          console.log('Error de inicialización:', msg);
        }
      } finally {
        setLoading(false);
      }
    };

    inicializar();

    // Escuchar cambios (login / logout / refresh automático)
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, s) => {
      setSession(s);
      await cargarPerfil(s);
      setLoading(false);
    });

    return () => {
      if (listener?.subscription) listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, perfil, loading, recargarPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);