'use client';

import React, { useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  MessageSquarePlus,
  Check,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatGuaranies } from '../utils/whatsapp';

export const CartDrawer: React.FC = () => {
  const {
    items,
    isCartOpen,
    setIsCartOpen,
    updateQuantity,
    updateInstructions,
    removeFromCart,
    clearCart,
    totalItems,
    totalPrice,
    setIsCheckoutOpen,
  } = useCart();

  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  if (!isCartOpen) return null;

  const handleProceedToCheckout = () => {
    setEditingNoteId(null);
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-zinc-950 border-l border-zinc-800 text-white flex flex-col shadow-2xl">
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 bg-orange-500/10 rounded-xl text-orange-400">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Mi Pedido</h2>
                <p className="text-xs text-zinc-400">
                  {totalItems === 0
                    ? 'Carrito vacío'
                    : `${totalItems} ${totalItems === 1 ? 'unidad añadida' : 'unidades añadidas'}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              aria-label="Cerrar carrito"
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto dark-scrollbar px-4 sm:px-6 py-4 space-y-3.5">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-3">
                <span className="text-5xl">🍔</span>
                <p className="text-base font-semibold text-zinc-300">¡Tu pedido está esperando!</p>
                <p className="text-xs max-w-xs">
                  Agrega deliciosas hamburguesas artesanales o combos a tu carrito.
                </p>
              </div>
            ) : (
              items.map((item) => {
                const isEditingNote = editingNoteId === item.product.id;
                const hasNote = Boolean(item.instructions?.trim());

                return (
                  <div
                    key={item.product.id}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 space-y-2.5"
                  >
                    <div className="flex gap-3 items-center">
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="w-16 h-16 rounded-lg object-cover bg-zinc-800 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">
                          {item.product.name}
                        </h4>
                        <p className="text-xs font-semibold text-amber-400">
                          {formatGuaranies(item.product.price)} c/u
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                            aria-label={`Disminuir cantidad de ${item.product.name}`}
                            className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 transition active:scale-90"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-sm sm:text-xs font-bold w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                            aria-label={`Aumentar cantidad de ${item.product.name}`}
                            className="w-8 h-8 sm:w-7 sm:h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300 transition active:scale-90"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end justify-between self-stretch">
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product.id)}
                          aria-label={`Eliminar ${item.product.name}`}
                          className="text-zinc-500 hover:text-red-400 p-1 transition"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <span className="text-xs font-bold text-zinc-200 whitespace-nowrap">
                          {formatGuaranies(item.product.price * item.quantity)}
                        </span>
                      </div>
                    </div>

                    {/* Nota personalizada por ítem */}
                    {isEditingNote ? (
                      <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80">
                        <input
                          type="text"
                          autoFocus
                          value={item.instructions || ''}
                          onChange={(e) => updateInstructions(item.product.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') setEditingNoteId(null);
                          }}
                          placeholder="Ej: Sin cebolla, sin tomate, cheddar aparte..."
                          className="flex-1 px-3 py-1.5 bg-zinc-950 border border-zinc-700 focus:border-orange-500 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingNoteId(null)}
                          aria-label="Guardar nota"
                          className="p-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white transition shrink-0"
                          title="Guardar nota"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="pt-1 border-t border-zinc-800/70 flex items-center justify-between gap-2">
                        {hasNote ? (
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(item.product.id)}
                            className="text-left text-[11px] text-amber-300/90 hover:text-amber-200 truncate flex items-center gap-1.5 transition"
                          >
                            <MessageSquarePlus className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                            <span className="truncate">Nota: {item.instructions}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(item.product.id)}
                            className="text-[11px] text-zinc-400 hover:text-orange-300 flex items-center gap-1.5 transition"
                          >
                            <MessageSquarePlus className="w-3.5 h-3.5 shrink-0" />
                            <span>Agregar nota (ej: sin cebolla, punto de carne)</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <div className="px-4 sm:px-6 py-5 border-t border-zinc-800 bg-zinc-950 space-y-3.5">
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Subtotal ({totalItems} unid.)</span>
                  <span className="font-semibold text-zinc-200">
                    {formatGuaranies(totalPrice)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Envío</span>
                  <span className="font-medium text-emerald-400">
                    A coordinar • Retiro gratis
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-base font-bold pt-2 border-t border-zinc-800/80">
                <span className="text-white">Total productos</span>
                <span className="text-xl text-amber-400">{formatGuaranies(totalPrice)}</span>
              </div>

              <button
                onClick={handleProceedToCheckout}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-base shadow-lg shadow-orange-600/30 transition flex items-center justify-center space-x-2"
              >
                <span>Continuar con el Pedido</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={clearCart}
                className="w-full py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition text-center"
              >
                Vaciar Carrito
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
