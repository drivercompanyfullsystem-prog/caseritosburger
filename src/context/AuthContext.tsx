'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';

export interface AdminUser {
  uid?: string;
  email: string | null;
}

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      const data = (await res.json()) as { authenticated?: boolean; user?: AdminUser | null };
      if (data.authenticated && data.user) {
        setUser((prev) => ({ uid: prev?.uid, email: data.user?.email || null }));
      } else if (!isFirebaseConfigured()) {
        setUser(null);
      }
    } catch {
      if (!isFirebaseConfigured()) setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.removeItem('caseritos_auth_user');
      localStorage.removeItem('caseritos_admin_session');
    } catch {
      // ignorar
    }

    if (isFirebaseConfigured() && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }

    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    // 1. Si Firebase Auth está activo, autenticar contra Firebase (para dar acceso real a Firestore/Storage)
    if (isFirebaseConfigured() && auth) {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: idToken }),
      });

      if (!res.ok) {
        throw new Error('No se pudo establecer la cookie de sesión en el servidor.');
      }

      setUser({
        uid: userCredential.user.uid,
        email: userCredential.user.email,
      });
      return;
    }

    // 2. Si Firebase no está configurado, autenticar contra /api/auth/login (ADMIN_PASSWORD)
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      user?: AdminUser;
    };

    if (!res.ok) {
      throw new Error(data.error || 'Correo o contraseña incorrectos.');
    }

    setUser(data.user || { email });
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      if (isFirebaseConfigured() && auth) {
        await signOut(auth);
      }
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe utilizarse dentro de un AuthProvider');
  }
  return context;
}
