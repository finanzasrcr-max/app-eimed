import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'operativo';
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  /** La sesión caducó mientras el usuario trabajaba; pedir re-login sin desmontar la vista */
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
  createUser: (email: string, password: string, fullName: string, role: 'admin' | 'operativo') => Promise<{ error: string | null }>;
  updateUserRole: (userId: string, role: 'admin' | 'operativo') => Promise<void>;
  listUsers: () => Promise<UserProfile[]>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // Distinguir cierre de sesión voluntario de una sesión caducada
  const explicitLogoutRef = useRef(false);
  const hadUserRef = useRef(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('[AuthContext] fetchProfile error:', error);
      }
      setProfile(data || null);
    } catch (e) {
      console.error('[AuthContext] fetchProfile exception:', e);
      setProfile(null);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      if (import.meta.env.PROD) {
        // En producción, si Supabase no está configurado, no asignar ningún rol
        setLoading(false);
        return;
      }
      // Solo en desarrollo: usuario local de conveniencia
      setUser({ id: 'local', email: 'local@eimed.com' } as User);
      setProfile({ id: 'local', email: 'local@eimed.com', full_name: 'Usuario Local', role: 'admin' });
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        hadUserRef.current = true;
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        hadUserRef.current = true;
        setUser(session.user);
        setSessionExpired(false);
        fetchProfile(session.user.id);
        return;
      }
      // Sin sesión: si el usuario estaba trabajando y NO cerró sesión él mismo
      // (token caducado, refresh fallido al volver de segundo plano), conservamos
      // la vista montada y pedimos re-login por modal en lugar de ir a /login.
      if (hadUserRef.current && !explicitLogoutRef.current) {
        setSessionExpired(true);
        return;
      }
      setUser(null);
      setProfile(null);
      setSessionExpired(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const logout = async () => {
    explicitLogoutRef.current = true;
    hadUserRef.current = false;
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setProfile(null);
      setSessionExpired(false);
      explicitLogoutRef.current = false;
    }
  };

  const createUser = async (
    email: string,
    password: string,
    fullName: string,
    role: 'admin' | 'operativo'
  ): Promise<{ error: string | null }> => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      // Upsert profile with correct role (trigger may set default)
      await supabase.from('profiles').upsert({
        id: data.user.id,
        email,
        full_name: fullName,
        role,
      });
    }
    return { error: null };
  };

  const updateUserRole = async (userId: string, role: 'admin' | 'operativo') => {
    await supabase.from('profiles').update({ role }).eq('id', userId);
  };

  const listUsers = async (): Promise<UserProfile[]> => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    return (data || []) as UserProfile[];
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        isAdmin: profile?.role === 'admin',
        sessionExpired,
        login,
        logout,
        createUser,
        updateUserRole,
        listUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
