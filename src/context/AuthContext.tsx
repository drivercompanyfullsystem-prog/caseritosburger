'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../lib/firebase';

export interface AdminUser {
  uid: string;
  email: string | null;
}

interface AuthContextType {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
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
    } else {
      // Fallback en modo desarrollo local cuando Firebase aún no tiene credenciales en .env.local
      try {
        const savedUser = localStorage.getItem('caseritos_auth_user');
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (e) {
        console.warn('Error leyendo sesión local:', e);
      }
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
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

    // Modo fallback local (cuando aún no se han configurado las variables NEXT_PUBLIC_FIREBASE_* en .env.local)
    if (password === 'admin1234' || password === '1234') {
      const mockToken = `local-firebase-token-${btoa(email)}-${Date.now()}`;
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mockToken }),
      });

      if (!res.ok) {
        throw new Error('No se pudo establecer la sesión.');
      }

      const adminUser: AdminUser = {
        uid: 'local-admin-uid',
        email,
      };
      localStorage.setItem('caseritos_auth_user', JSON.stringify(adminUser));
      setUser(adminUser);
    } else {
      throw new Error('Credenciales inválidas. Verifica tu correo y contraseña.');
    }
  };

  const logout = async () => {
    await fetch('/api/auth/session', {
      method: 'DELETE',
    });

    if (isFirebaseConfigured() && auth) {
      await signOut(auth);
    }

    if (typeof window !== 'undefined') {
      localStorage.removeItem('caseritos_auth_user');
      localStorage.removeItem('caseritos_admin_session');
    }

    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
