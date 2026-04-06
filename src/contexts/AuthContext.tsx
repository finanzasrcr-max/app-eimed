import React, { createContext, useContext, useEffect, useState } from 'react';
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
      // Modo local: usuario ficticio admin
      setUser({ id: 'local', email: 'local@eimed.com' } as User);
      setProfile({ id: 'local', email: 'local@eimed.com', full_name: 'Usuario Local', role: 'admin' });
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message || null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
