'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { Hero } from '@/components/Hero';
import { CategoryFilter } from '@/components/CategoryFilter';
import { ProductCard } from '@/components/ProductCard';
import { CartDrawer } from '@/components/CartDrawer';
import { CheckoutModal } from '@/components/CheckoutModal';
import { AiAssistant } from '@/components/AiAssistant';
import { Product } from '@/types';
import { fetchProducts } from '@/lib/firebase';
import { Search, Sparkles, FileDown, Heart, ArrowRight, X, Tag, Loader2 } from 'lucide-react';
import { generateMenuPDF } from '@/utils/pdfGenerator';
import { useCart } from '@/context/CartContext';
import { formatGuaranies } from '@/utils/whatsapp';
import { matchesCategoryFilter } from '@/constants/categories';

const CATEGORIES = [
  { id: 'all', label: 'Todo el Menú', icon: '🔥', subtitle: '' },
  {
    id: 'hamburguesas',
    label: 'Hamburguesas',
    icon: '🍔',
    subtitle: 'Elige cada hamburguesa sola o en combo con papas y gaseosa',
  },
  {
    id: 'combos',
    label: 'Combos & Promos',
    icon: '📦',
    subtitle: 'Incluyen hamburguesa + papa frita + gaseosa 250ml',
  },
  {
    id: 'papas_entradas',
    label: 'Papas & Entradas',
    icon: '🍟',
    subtitle: 'Porciones recién hechas para acompañar tu pedido',
  },
  {
    id: 'agregados',
    label: 'Agregados Extras',
    icon: '🧀',
    subtitle: 'Súmale más sabor a tu hamburguesa favorita',
  },
  { id: 'bebidas', label: 'Bebidas', icon: '🥤', subtitle: 'Bien frías para acompañar' },
  { id: 'postres', label: 'Postres', icon: '🍦', subtitle: 'El toque dulce final' },
];

function findComboProduct(product: Product, allProducts: Product[]): Product | undefined {
  if (product.category !== 'hamburguesas') return undefined;
  const expectedId = product.id.replace(/^burger-/, 'combo-');
  const normalizedName = `combo ${product.name.trim().toLowerCase()}`;
  return allProducts.find(
    (candidate) =>
      candidate.category === 'combos' &&
      (candidate.id === expectedId || candidate.name.trim().toLowerCase() === normalizedName)
  );
}

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Carrito y notificaciones de cliente
  const { totalItems, totalPrice, setIsCartOpen, isCartOpen, toastMessage, clearToast } = useCart();

  // Asistente IA
  const [isAiOpen, setIsAiOpen] = useState(false);

  // Mostrar barra flotante del carrito solo tras hacer scroll pasado el Hero
  const [showFloatingCart, setShowFloatingCart] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setShowFloatingCart(window.scrollY > 240);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const prods = await fetchProducts();
        setProducts(prods);
      } catch (err) {
        console.error('Error al cargar productos:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

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

  const scrollToMenu = () => {
    menuRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const visibleCategories = CATEGORIES.filter(
    (cat) =>
      cat.id === 'all' ||
      products.length === 0 ||
      products.some((p) => matchesCategoryFilter(p.category, cat.id))
  );

  useEffect(() => {
    if (
      products.length > 0 &&
      activeCategory !== 'all' &&
      !visibleCategories.some((c) => c.id === activeCategory)
    ) {
      setActiveCategory('all');
    }
  }, [products, activeCategory, visibleCategories]);

  const filteredProducts = products.filter((p) => {
    const matchesCategory = matchesCategoryFilter(p.category, activeCategory);
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.tags && p.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    return matchesCategory && matchesSearch;
  });

  const isFloatingCartVisible = totalItems > 0 && !isCartOpen && showFloatingCart;

  return (
    <div className={`min-h-screen bg-zinc-950 flex flex-col text-white selection:bg-orange-500 ${totalItems > 0 ? 'pb-28' : 'pb-16'}`}>
      {/* Toast no intrusivo al agregar producto */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="bg-zinc-900/95 border border-amber-500/60 text-white px-5 py-3 rounded-2xl shadow-2xl shadow-black/80 flex items-center space-x-3 backdrop-blur-md">
            <span className="text-xl">🍔</span>
            <span className="text-xs sm:text-sm font-bold text-amber-300">{toastMessage}</span>
            <button
              onClick={() => setIsCartOpen(true)}
              className="ml-2 text-xs font-black bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white px-3 py-1.5 rounded-xl transition shadow"
            >
              Ver Carrito
            </button>
            <button
              onClick={clearToast}
              className="text-zinc-500 hover:text-white p-0.5 ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header Público del Cliente */}
      <Header
        products={products}
        onOpenAi={() => setIsAiOpen(true)}
      />

      {/* Hero Principal con Logo / Perfil Oficial */}
      <Hero
        onExploreMenu={scrollToMenu}
        onOpenAi={() => setIsAiOpen(true)}
      />

      {/* Contenido del Menú */}
      <main ref={menuRef} className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
        {/* Banner de Días de Promo visible para clientes */}
        <div className="mb-10 bg-gradient-to-r from-amber-600/20 via-orange-600/25 to-yellow-600/20 border border-amber-500/40 rounded-3xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center space-x-3.5 sm:space-x-4">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center text-2xl flex-shrink-0 shadow-lg shadow-orange-600/30">
              🎉
            </div>
            <div>
              <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                <span className="text-[11px] font-black px-2 py-0.5 rounded bg-orange-600 text-white uppercase">
                  Promociones
                </span>
                <h3 className="font-extrabold text-base sm:text-lg text-amber-300 leading-snug">
                  ¡Días de Promo en Caseritos Burguer!
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-zinc-300 mt-1.5 leading-relaxed">
                • <strong>Miércoles & Jueves:</strong> 2x1 en hamburguesas seleccionadas.{' '}
                • <strong>Viernes & Sábados:</strong> Papas con cheddar y bacon gratis en tus combos.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setActiveCategory('combos');
              setSearchQuery('');
              catalogRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs flex items-center justify-center space-x-2 transition shadow-md flex-shrink-0"
          >
            <Tag className="w-4 h-4" />
            <span>Ver Combos & Promos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Cabecera de la sección de Menú */}
        <div ref={catalogRef} className="scroll-mt-24 flex flex-col md:flex-row md:items-end justify-between gap-5 mb-6">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black tracking-widest text-orange-500 uppercase">
                CARTA VIRTUAL
              </span>
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white mt-1">
              Menú para Pedidos Online
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              Hamburguesas 100% caseras preparadas al momento en Km 13.5. Agrega tus platos y pide directo por WhatsApp
            </p>
          </div>

          {/* Barra de Búsqueda */}
          <div className="relative w-full md:w-72 lg:w-80 shrink-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar hamburguesa o ingrediente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white placeholder-zinc-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Filtro por Categorías */}
        <div className="mb-8">
          <CategoryFilter
            categories={visibleCategories}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
          />
        </div>

        {/* Grilla de Productos */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-zinc-500 space-y-3">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Cargando menú de Caseritos Burguer...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 max-w-lg mx-auto">
            <span className="text-5xl">🔍</span>
            <h3 className="mt-4 text-lg font-bold text-white">No encontramos productos</h3>
            <p className="mt-1 text-xs text-zinc-400">
              Prueba buscando con otro término o selecciona otra categoría.
            </p>
            <button
              onClick={() => {
                setActiveCategory('all');
                setSearchQuery('');
              }}
              className="mt-5 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : activeCategory === 'all' && !searchQuery.trim() ? (
          <div className="space-y-12">
            {visibleCategories
              .filter((cat) => cat.id !== 'all')
              .map((cat) => {
                const sectionProducts = products.filter((p) =>
                  matchesCategoryFilter(p.category, cat.id)
                );
                if (sectionProducts.length === 0) return null;

                return (
                  <section key={cat.id} className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-2 pb-2 border-b border-zinc-800/80">
                      <div>
                        <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </h3>
                        {cat.subtitle && (
                          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">{cat.subtitle}</p>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-full">
                        {sectionProducts.length}{' '}
                        {sectionProducts.length === 1 ? 'opción' : 'opciones'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {sectionProducts.map((product) => (
                        <ProductCard
                          key={product.id}
                          product={product}
                          comboProduct={findComboProduct(product, products)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                comboProduct={findComboProduct(product, products)}
              />
            ))}
          </div>
        )}

        {/* Banner Descarga PDF & Asistencia */}
        <div className="mt-16 bg-gradient-to-r from-orange-950/40 via-zinc-900 to-amber-950/40 border border-orange-500/30 rounded-3xl p-6 sm:p-10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start space-x-2">
              <Tag className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                Carta Ilustrada con Fotos & Promos
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              ¿Deseas tener nuestro menú completo en PDF?
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 max-w-xl">
              Descarga la carta oficial con fotos de cada hamburguesa, especificaciones de ingredientes, días de promociones y precios en Guaraníes.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={handleDownloadPDF}
              disabled={isGeneratingPdf}
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-sm shadow-lg shadow-orange-600/30 transition flex items-center space-x-2"
            >
              {isGeneratingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Preparando Fotos en PDF...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Descargar Menú PDF Ilustrado</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsAiOpen(true)}
              className="px-6 py-3.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-purple-500/40 text-purple-200 font-semibold text-sm transition flex items-center space-x-2"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Consultar a la IA</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 text-zinc-500 text-xs py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full overflow-hidden border border-amber-500/60 bg-black flex items-center justify-center">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-bold text-zinc-300">Caseritos Burguer</span>
            <span>• Km 13.5</span>
          </div>

          <div className="flex items-center space-x-1">
            <span>Hecho con</span>
            <Heart className="w-3.5 h-3.5 text-red-500 inline fill-red-500" />
            <span>hamburguesas 100% caseras</span>
          </div>
        </div>
      </footer>

      {/* BARRA FLOTANTE INFERIOR: Resumen de pedido para el cliente */}
      {isFloatingCartVisible && (
        <aside aria-label="Resumen de pedido" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md animate-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={() => setIsCartOpen(true)}
            className="w-full bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white px-3.5 py-3 rounded-2xl shadow-2xl shadow-orange-950/80 border border-amber-400/40 flex items-center justify-between transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-black/40 flex items-center justify-center font-black text-sm text-white border border-white/10 shrink-0">
                {totalItems}
              </div>
              <div className="text-left">
                <p className="text-[11px] font-semibold text-orange-100 leading-tight">Tu Pedido Caserito</p>
                <p className="text-sm sm:text-base font-black text-white leading-tight">{formatGuaranies(totalPrice)}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 font-bold text-xs sm:text-sm bg-black/30 hover:bg-black/50 px-3 py-2 rounded-xl border border-white/15 transition whitespace-nowrap shrink-0">
              <span>Ver Pedido</span>
              <ArrowRight className="w-4 h-4 text-amber-300" />
            </div>
          </button>
        </aside>
      )}

      {/* Botón Flotante Asistente IA */}
      <button
        onClick={() => setIsAiOpen(true)}
        className={`fixed right-4 sm:right-5 z-30 h-12 rounded-full bg-gradient-to-tr from-purple-600 via-orange-600 to-amber-500 text-white shadow-2xl shadow-orange-600/40 hover:scale-105 active:scale-95 transition-all flex items-center justify-center border border-white/20 px-3.5 xl:px-4 gap-2 ${
          isFloatingCartVisible ? 'bottom-24 md:bottom-5' : 'bottom-5'
        }`}
        title="Consultar a CaceriBot IA"
        aria-label="Consultar a CaceriBot IA"
      >
        <Sparkles className="w-5 h-5 text-amber-300 animate-pulse shrink-0" />
        <span className="hidden xl:inline font-bold text-sm whitespace-nowrap">CaceriBot IA</span>
      </button>

      {/* Modales de Cliente */}
      <CartDrawer />
      <CheckoutModal />
      <AiAssistant
        products={products}
        isOpen={isAiOpen}
        onClose={() => setIsAiOpen(false)}
      />
    </div>
  );
}
