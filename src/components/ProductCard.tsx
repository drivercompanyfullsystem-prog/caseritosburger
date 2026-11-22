'use client';

import React, { useState } from 'react';
import { Plus, Minus, Flame, Package, Sparkles } from 'lucide-react';
import { Product } from '../types';
import { formatGuaranies } from '../utils/whatsapp';
import { useCart } from '../context/CartContext';
import { getCategoryLabel, getCategoryPresetImage } from '../constants/categories';

interface ProductCardProps {
  product: Product;
  comboProduct?: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, comboProduct }) => {
  const { addToCart, updateQuantity, items } = useCart();
  const hasComboOption = Boolean(product.available && comboProduct && comboProduct.available);
  const [selectedMode, setSelectedMode] = useState<'solo' | 'combo'>('solo');

  const activeProduct =
    hasComboOption && selectedMode === 'combo' && comboProduct ? comboProduct : product;

  const existingItem = items.find((item) => item.product.id === activeProduct.id);
  const soloQty = items.find((item) => item.product.id === product.id)?.quantity || 0;
  const comboQty = comboProduct
    ? items.find((item) => item.product.id === comboProduct.id)?.quantity || 0
    : 0;
  const anyVariantInCart = soloQty > 0 || comboQty > 0;

  const visibleTags = (activeProduct.tags || []).filter(
    (tag) => !(hasComboOption && /^combo\s+gs\./i.test(tag.trim()))
  );

  const isPromoActive = Boolean(activeProduct.isPromo && activeProduct.available);
  const promoBadgeText = activeProduct.promoLabel?.trim() || 'PROMO';

  return (
    <div
      className={`group relative bg-zinc-900/90 border rounded-2xl overflow-hidden shadow-lg transition-all duration-300 flex flex-col ${
        isPromoActive
          ? 'border-amber-400/90 ring-1 ring-yellow-300/60 promo-golden-card'
          : anyVariantInCart
          ? 'border-orange-500/60 shadow-orange-950/30'
          : 'border-zinc-800 hover:border-orange-500/40 hover:shadow-orange-950/20'
      }`}
    >
      {/* Image Container */}
      <div
        className={`relative aspect-[4/3] w-full overflow-hidden bg-zinc-950 ${
          isPromoActive
            ? 'promo-golden-shimmer ring-2 ring-inset ring-amber-300/80 shadow-[inset_0_0_24px_rgba(251,191,36,0.35)]'
            : ''
        }`}
      >
        <img
          src={activeProduct.imageUrl || getCategoryPresetImage(activeProduct.category)}
          alt={activeProduct.name}
          onError={(e) => {
            const target = e.currentTarget;
            const fallback = getCategoryPresetImage(activeProduct.category);
            if (target.src !== fallback) target.src = fallback;
          }}
          className={`w-full h-full ${
            (activeProduct.imageUrl || '').includes('papas')
              ? 'object-contain bg-black'
              : 'object-cover object-center'
          } group-hover:scale-105 transition-transform duration-500`}
          loading="lazy"
        />
        <div
          className={`absolute inset-0 pointer-events-none ${
            isPromoActive
              ? 'bg-gradient-to-t from-zinc-950/85 via-amber-400/10 to-yellow-300/15'
              : 'bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60'
          }`}
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
          {isPromoActive && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-black tracking-wide uppercase bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 text-zinc-950 shadow-lg shadow-amber-500/40 border border-yellow-200/80">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{promoBadgeText}</span>
            </span>
          )}
          {product.isPopular && !isPromoActive && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-zinc-950 backdrop-blur-md shadow-sm">
              <Flame className="w-3.5 h-3.5" />
              <span>Casera Favorita</span>
            </span>
          )}
          {hasComboOption && selectedMode === 'combo' && (
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-orange-600 text-white backdrop-blur-md shadow-sm">
              <Package className="w-3.5 h-3.5" />
              <span>Combo Completo</span>
            </span>
          )}
          {!activeProduct.available && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-600/95 text-white backdrop-blur-md">
              Agotado
            </span>
          )}
        </div>

        {/* Price tag pill */}
        <div
          className={`absolute bottom-3 right-3 z-10 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg ${
            isPromoActive
              ? 'bg-gradient-to-r from-amber-500 to-yellow-400 border border-yellow-200 text-zinc-950 shadow-amber-500/40'
              : 'bg-zinc-950/90 border border-zinc-700/80'
          }`}
        >
          <span
            className={`text-base font-black ${
              isPromoActive ? 'text-zinc-950' : 'text-amber-400'
            }`}
          >
            {formatGuaranies(activeProduct.price)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 className="text-lg font-bold text-white group-hover:text-orange-400 transition-colors">
            {activeProduct.name}
          </h3>

          <p className="mt-2 text-xs sm:text-sm text-zinc-400 line-clamp-2 leading-relaxed">
            {activeProduct.description}
          </p>

          {/* Selector interactivo Solo vs Combo */}
          {hasComboOption && comboProduct && (
            <div className="mt-3.5 space-y-1.5">
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-950/90 border border-zinc-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setSelectedMode('solo')}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition flex flex-col items-center justify-center leading-tight ${
                    selectedMode === 'solo'
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <span>Solo</span>
                    {soloQty > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-black/30 text-[10px]">
                        {soloQty}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] opacity-90 whitespace-nowrap">
                    {formatGuaranies(product.price)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMode('combo')}
                  className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition flex flex-col items-center justify-center leading-tight ${
                    selectedMode === 'combo'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    <span>Combo</span>
                    {comboQty > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-black/25 text-[10px]">
                        {comboQty}
                      </span>
                    )}
                  </span>
                  <span className="text-[10px] opacity-90 whitespace-nowrap">
                    {formatGuaranies(comboProduct.price)}
                  </span>
                </button>
              </div>
              {selectedMode === 'combo' && (
                <p className="text-[11px] text-amber-300/90 font-medium px-1">
                  Incluye papa frita + gaseosa 250ml
                </p>
              )}
            </div>
          )}

          {/* Tags */}
          {visibleTags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {visibleTags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-800 text-zinc-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls (Vista Exclusiva del Cliente) */}
        <div className="mt-5 pt-3 border-t border-zinc-800/80">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-zinc-500 uppercase tracking-wider font-semibold truncate">
              {getCategoryLabel(activeProduct.category)}
            </span>

            {!activeProduct.available ? (
              <span className="text-xs font-bold text-red-400 bg-red-950/30 px-3 py-1.5 rounded-xl border border-red-800/40 whitespace-nowrap shrink-0">
                No disponible hoy
              </span>
            ) : existingItem ? (
              <div className="flex items-center space-x-1.5 bg-gradient-to-r from-orange-600 to-amber-600 rounded-xl p-1 shadow-md shadow-orange-950/40 animate-in fade-in shrink-0">
                <button
                  type="button"
                  onClick={() => updateQuantity(activeProduct.id, existingItem.quantity - 1)}
                  aria-label={`Disminuir ${activeProduct.name}`}
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition active:scale-90"
                  title="Disminuir"
                >
                  <Minus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
                <span className="text-sm sm:text-xs font-black text-white px-2 min-w-[26px] text-center">
                  {existingItem.quantity}
                </span>
                <button
                  type="button"
                  onClick={() => addToCart(activeProduct, 1)}
                  aria-label={`Aumentar ${activeProduct.name}`}
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-black/30 hover:bg-black/50 flex items-center justify-center text-white transition active:scale-90"
                  title="Aumentar"
                >
                  <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => addToCart(activeProduct, 1)}
                className="flex items-center space-x-1.5 min-h-[40px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-900/30 transition-all transform active:scale-95 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Agregar</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
