'use client';

import React, { useState } from 'react';
import { ShoppingBag, FileDown, Sparkles, Loader2 } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Product } from '../types';
import { generateMenuPDF } from '../utils/pdfGenerator';

interface HeaderProps {
  products: Product[];
  onOpenAi: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  products,
  onOpenAi,
}) => {
  const { totalItems, setIsCartOpen } = useCart();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      await generateMenuPDF(products);
    } catch (e) {
      console.error('Error generating PDF:', e);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-3">
        {/* Logo & Perfil de la marca */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div className="relative group cursor-pointer shrink-0">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-amber-500/80 shadow-lg shadow-orange-500/20 bg-black flex items-center justify-center p-0.5">
              <img
                src="/logo.jpg"
                alt="Caseritos Burguer Logo"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-emerald-500 border-2 border-zinc-950" title="Local Abierto" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <span className="text-[15px] sm:text-xl lg:text-2xl font-black tracking-tight bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent whitespace-nowrap">
                CASERITOS
              </span>
              <span className="text-[9px] sm:text-xs font-black px-1 sm:px-1.5 py-0.5 rounded bg-orange-600 text-white shrink-0">
                BURGUER
              </span>
            </div>
            <span className="block text-[10px] sm:text-[11px] font-semibold tracking-wider text-zinc-400 uppercase truncate">
              <span className="sm:hidden">Km 13.5 • Caseras</span>
              <span className="hidden sm:inline">Hamburguesas Caseras • Km 13.5</span>
            </span>
          </div>
        </div>

        {/* Acciones del Cliente: IA, Menú PDF y Carrito */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Botón IA (oculto en móvil porque ya está el botón flotante de IA) */}
          <button
            onClick={onOpenAi}
            className="hidden sm:flex items-center space-x-1.5 px-3 py-2 lg:px-4 lg:py-2.5 rounded-xl bg-gradient-to-r from-purple-600/30 to-orange-600/30 hover:from-purple-600/50 hover:to-orange-600/50 border border-purple-500/30 text-purple-200 text-xs sm:text-sm font-medium transition whitespace-nowrap shrink-0"
            title="Consultar al Asistente IA"
          >
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
            <span className="hidden md:inline lg:hidden">IA</span>
            <span className="hidden lg:inline">CaceriBot IA</span>
          </button>

          {/* Descargar PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf}
            aria-label="Descargar Menú PDF"
            className="flex items-center justify-center space-x-1.5 min-w-[40px] min-h-[40px] px-2.5 sm:px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs sm:text-sm font-medium transition whitespace-nowrap shrink-0"
            title="Descargar Carta en PDF con Fotos y Promos"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="w-4 h-4 text-orange-400 animate-spin shrink-0" />
                <span className="hidden sm:inline">Generando...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 text-orange-400 shrink-0" />
                <span className="hidden sm:inline">Menú PDF</span>
              </>
            )}
          </button>

          {/* Carrito de Pedido del Cliente */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="relative flex items-center space-x-1.5 sm:space-x-2 min-h-[40px] px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold shadow-lg shadow-orange-600/30 transition transform active:scale-95 whitespace-nowrap shrink-0"
            aria-label="Ver pedido"
          >
            <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
            <span className="text-[11px] sm:text-sm">
              <span className="sm:hidden">Pedido</span>
              <span className="hidden sm:inline">Mi Pedido</span>
            </span>
            {totalItems > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] sm:min-w-[20px] px-1 sm:px-1.5 py-0.5 text-[11px] sm:text-xs font-black bg-white text-orange-600 rounded-full shadow">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
