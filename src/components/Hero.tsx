'use client';

import React from 'react';
import { Sparkles, MessageCircle, ArrowRight, ShieldCheck, Clock, Flame } from 'lucide-react';

interface HeroProps {
  onExploreMenu: () => void;
  onOpenAi: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  onExploreMenu,
  onOpenAi,
}) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 py-12 sm:py-20 border-b border-zinc-800">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-orange-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto">
          {/* Logo Central / Perfil de la marca */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 border-amber-500 shadow-2xl shadow-orange-500/40 bg-black flex items-center justify-center p-1 transform hover:scale-105 transition-transform duration-300">
                <img
                  src="/logo.jpg"
                  alt="Caseritos Burguer Perfil"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div className="absolute -bottom-2 -right-1 bg-gradient-to-r from-orange-600 to-amber-600 px-3 py-1 rounded-full text-[11px] font-black tracking-wider uppercase text-white shadow-lg border border-amber-400/40">
                100% Caseras
              </div>
            </div>
          </div>

          {/* Badge de estado */}
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs sm:text-sm font-semibold mb-4">
            <Flame className="w-4 h-4 text-orange-500" />
            <span>Hamburguesas 100% Caseras • Km 13.5</span>
          </div>

          {/* Heading */}
          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
            El verdadero sabor de{' '}
            <span className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-500 bg-clip-text text-transparent">
              Caseritos Burguer
            </span>
          </h1>

          <p className="mt-4 text-base sm:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Elige tus hamburguesas favoritas, arma tu pedido online y envíalo directo por WhatsApp con entrega rápida.
          </p>

          {/* Call to Actions */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onExploreMenu}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-base shadow-lg shadow-orange-600/30 transition transform hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center space-x-2"
            >
              <span>Hacer Pedido Ahora</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            <button
              onClick={onOpenAi}
              className="w-full sm:w-auto px-7 py-4 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-purple-500/40 text-purple-200 font-semibold text-base transition flex items-center justify-center space-x-2 shadow-lg shadow-purple-900/20"
            >
              <Sparkles className="w-5 h-5 text-amber-400" />
              <span>Recomendación con IA</span>
            </button>
          </div>

          {/* Micro features para clientes */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-zinc-800/80 text-zinc-400 text-xs sm:text-sm">
            <div className="flex items-center justify-center space-x-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>Pedidos directos a WhatsApp</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Envíos rápidos a domicilio</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span>Carne casera de primera</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
