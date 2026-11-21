'use client';

import React, { useState } from 'react';
import { X, Lock, ShieldCheck, KeyRound } from 'lucide-react';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // PIN por defecto: 1234 o clave configurada
    if (pin === '1234' || pin === 'admin') {
      setError('');
      setPin('');
      onSuccess();
    } else {
      setError('PIN incorrecto. Intenta con 1234');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-zinc-950 border border-amber-500/40 rounded-3xl max-w-sm w-full text-white shadow-2xl overflow-hidden p-6 text-center">
        {/* Header Icon */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-7 h-7" />
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold">Acceso Administrador</h3>
        <p className="text-xs text-zinc-400 mt-1">
          Ingresa el PIN de seguridad para editar el menú, precios y disponibilidad.
        </p>

        <form onSubmit={handleLogin} className="mt-5 space-y-4">
          <div>
            <input
              type="password"
              maxLength={10}
              placeholder="Ingresa tu PIN (1234)"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError('');
              }}
              autoFocus
              className="w-full text-center tracking-widest text-lg font-bold px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl focus:outline-none focus:border-amber-500 text-white placeholder-zinc-600"
            />
            {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
          </div>

          <p className="text-[11px] text-zinc-500">
            PIN inicial sugerido: <strong className="text-amber-400">1234</strong>
          </p>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm shadow-lg shadow-orange-600/30 transition flex items-center justify-center space-x-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Desbloquear Modo Administrador</span>
          </button>
        </form>
      </div>
    </div>
  );
};
