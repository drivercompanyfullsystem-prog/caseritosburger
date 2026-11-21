'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem } from '../types';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, instructions?: string, openDrawer?: boolean) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateInstructions: (productId: string, instructions: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (open: boolean) => void;
  toastMessage: string | null;
  clearToast: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Cargar carrito desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('caceritos_cart');
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (e) {
      console.warn('Error reading cart from localStorage', e);
    }
    setIsInitialized(true);
  }, []);

  // Guardar en localStorage
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem('caceritos_cart', JSON.stringify(items));
      } catch (e) {
        console.warn('Error saving cart to localStorage', e);
      }
    }
  }, [items, isInitialized]);

  const addToCart = (product: Product, quantity = 1, instructions = '', openDrawer = false) => {
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product.id === product.id);
      if (existingIndex > -1) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + quantity,
          instructions: instructions || next[existingIndex].instructions,
        };
        return next;
      }
      return [...prev, { product, quantity, instructions }];
    });

    // Notificación toast moderna y no intrusiva
    setToastMessage(`¡${product.name} agregado a tu pedido! 🍔`);
    setTimeout(() => {
      setToastMessage((cur) => (cur?.includes(product.name) ? null : cur));
    }, 2800);

    if (openDrawer) {
      setIsCartOpen(true);
    }
  };

  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
    );
  };

  const updateInstructions = (productId: string, instructions: string) => {
    setItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, instructions } : item))
    );
  };

  const clearCart = () => {
    setItems([]);
  };

  const clearToast = () => {
    setToastMessage(null);
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.quantity * item.product.price, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateInstructions,
        clearCart,
        totalItems,
        totalPrice,
        isCartOpen,
        setIsCartOpen,
        isCheckoutOpen,
        setIsCheckoutOpen,
        toastMessage,
        clearToast,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
