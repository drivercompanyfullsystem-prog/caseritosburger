'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, Mail, Lock, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';

export default function AdminLoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const firebaseActive = isFirebaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await login(email.trim(), password);
      router.push('/admin/dashboard');
      router.refresh();
    } catch (err: any) {
      const code = err?.code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found'
      ) {
        setError('Correo o contraseña incorrectos.');
      } else if (code === 'auth/invalid-email') {
        setError('El formato del correo electrónico no es válido.');
      } else if (code === 'auth/too-many-requests') {
        setError('Demasiados intentos fallidos. Intenta de nuevo más tarde.');
      } else {
        setError(err?.message || 'Error al iniciar sesión. Verifica tus credenciales.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Efectos de fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Enlace de retorno al menú público */}
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-zinc-400 hover:text-amber-400 mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Menú Público de Pedidos</span>
        </Link>

        <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
          {/* Logo y Título */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-amber-500 shadow-lg shadow-orange-500/20 bg-black p-0.5 mb-4">
              <img
                src="/logo.jpg"
                alt="Caseritos Burguer"
                className="w-full h-full object-cover rounded-full"
              />
            </div>

            <span className="text-[11px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 mb-2">
              Acceso Privado
            </span>
            <h1 className="text-2xl font-black text-white">Panel de Administración</h1>
            <p className="text-xs text-zinc-400 mt-1">
              Inicia sesión con tu cuenta de administrador para gestionar productos y precios
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/50 border border-red-700/60 text-red-300 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  placeholder="admin@caseritos.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {!firebaseActive && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-600/30 text-[11px] text-amber-300/90 leading-relaxed">
                <strong>Modo Local Activo:</strong> Configura tus variables de Firebase Auth en{' '}
                <code>.env.local</code> para autenticación en la nube, o ingresa con cualquier correo y clave{' '}
                <strong>admin1234</strong> (o <strong>1234</strong>).
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-orange-600/30 transition flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Ingresar al Dashboard</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
