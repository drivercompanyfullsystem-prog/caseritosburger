'use client';

import React, { useState, useEffect } from 'react';
import { X, Phone, Check, ExternalLink, HelpCircle } from 'lucide-react';
import { getBusinessWhatsAppPhone, normalizeParaguayPhone } from '../utils/whatsapp';
import { saveBusinessPhoneToCloud } from '../lib/firebase';

interface PhoneSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhoneUpdated?: (phone: string) => void;
}

export const PhoneSettingsModal: React.FC<PhoneSettingsModalProps> = ({
  isOpen,
  onClose,
  onPhoneUpdated,
}) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const current = getBusinessWhatsAppPhone();
      setPhoneNumber(current);
      setSavedSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const normalized = normalizeParaguayPhone(phoneNumber);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim()) return;

    await saveBusinessPhoneToCloud(phoneNumber);
    setSavedSuccess(true);
    if (onPhoneUpdated) {
      onPhoneUpdated(normalized);
    }
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleTestWhatsApp = () => {
    const testUrl = `https://api.whatsapp.com/send?phone=${normalized}&text=${encodeURIComponent(
      '\u{1F44B} ¡Hola! Mensaje de prueba desde Caseritos Burguer (Km 13.5). ¡Tu número está configurado correctamente!'
    )}`;
    window.open(testUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-zinc-950 border border-amber-500/40 rounded-3xl max-w-md w-full text-white shadow-2xl overflow-hidden p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Teléfono de Pedidos</h3>
              <p className="text-xs text-zinc-400">WhatsApp oficial del negocio</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1.5">
              Número de WhatsApp para recibir pedidos:
            </label>
            <input
              type="text"
              placeholder="Ej: 0981 123 456 ó 595981123456"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-base font-bold focus:outline-none focus:border-amber-500 text-amber-400 placeholder-zinc-600 tracking-wide"
              required
              autoFocus
            />
          </div>

          {/* Formato Detectado */}
          <div className="p-3 bg-zinc-900/80 rounded-xl border border-zinc-800 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Formato internacional generado:</span>
              <span className="font-mono font-bold text-emerald-400">+{normalized}</span>
            </div>
            <p className="text-[11px] text-zinc-500">
              Todos los clientes que envíen sus pedidos serán dirigidos directamente a este número de WhatsApp.
            </p>
          </div>

          {savedSuccess && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>¡Número guardado exitosamente!</span>
            </div>
          )}

          {/* Acciones */}
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/40 transition flex items-center justify-center space-x-2"
            >
              <Check className="w-4 h-4" />
              <span>Guardar Número de Pedidos</span>
            </button>

            <button
              type="button"
              onClick={handleTestWhatsApp}
              className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-semibold transition flex items-center justify-center space-x-2"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Probar en WhatsApp (+{normalized})</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
