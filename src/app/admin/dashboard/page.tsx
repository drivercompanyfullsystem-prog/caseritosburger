'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  PlusCircle,
  LogOut,
  Search,
  Edit,
  Trash2,
  Power,
  ExternalLink,
  Phone,
  Flame,
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Database,
} from 'lucide-react';
import { Product } from '@/types';
import {
  subscribeToProducts,
  fetchBusinessPhoneFromCloud,
  toggleProductAvailability,
  deleteProduct,
  isFirebaseConfigured,
} from '@/lib/firebase';
import { formatGuaranies, getBusinessWhatsAppPhone } from '@/utils/whatsapp';
import { useAuth } from '@/context/AuthContext';
import { CategoryFilter } from '@/components/CategoryFilter';
import { AdminProductModal } from '@/components/AdminProductModal';
import { EditProductModal } from '@/components/EditProductModal';
import { PhoneSettingsModal } from '@/components/PhoneSettingsModal';
import {
  getCategoryLabel,
  getCategoryPresetImage,
  matchesCategoryFilter,
} from '@/constants/categories';

const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: '🔥' },
  { id: 'hamburguesas', label: 'Hamburguesas', icon: '🍔' },
  { id: 'combos', label: 'Combos & Promos', icon: '📦' },
  { id: 'papas_entradas', label: 'Papas & Entradas', icon: '🍟' },
  { id: 'agregados', label: 'Agregados Extras', icon: '🧀' },
  { id: 'bebidas', label: 'Bebidas', icon: '🥤' },
  { id: 'postres', label: 'Postres', icon: '🍦' },
];

export default function AdminDashboardPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPhone, setCurrentPhone] = useState('595982606227');
  const [toast, setToast] = useState<string | null>(null);

  // Modales CRUD
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((cur) => (cur === msg ? null : cur));
    }, 2600);
  };

  useEffect(() => {
    setCurrentPhone(getBusinessWhatsAppPhone());
    fetchBusinessPhoneFromCloud().then((cloudPhone) => {
      if (cloudPhone) setCurrentPhone(cloudPhone);
    });

    setIsLoading(true);
    const unsubscribe = subscribeToProducts((list) => {
      setProducts(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/admin/login');
      router.refresh();
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
      setIsLoggingOut(false);
    }
  };

  const handleToggleAvailability = async (product: Product) => {
    const newStatus = await toggleProductAvailability(product.id, product.available);
    setProducts((prev) =>
      prev.map((p) => (p.id === product.id ? { ...p, available: newStatus } : p))
    );
    showToast(
      newStatus
        ? `"${product.name}" activado como Disponible`
        : `"${product.name}" marcado como Agotado`
    );
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setIsEditModalOpen(true);
  };

  const handleProductUpdated = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    showToast(`Cambios guardados en "${updated.name}"`);
  };

  const handleProductDeleted = (deletedId: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== deletedId));
    setDeletingProductId(null);
    showToast('Producto eliminado del menú');
  };

  const handleQuickDelete = async (id: string) => {
    await deleteProduct(id);
    handleProductDeleted(id);
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = matchesCategoryFilter(p.category, activeCategory);
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const availableCount = products.filter((p) => p.available).length;
  const outOfStockCount = products.length - availableCount;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col pb-12">
      {/* Toast de confirmación rápido */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-sm animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="bg-zinc-900/95 border border-amber-500/50 text-amber-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-2 text-xs font-semibold backdrop-blur-md">
            <span>{toast}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Cerrar aviso"
              className="text-zinc-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Barra Superior Responsive del Administrador */}
      <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2 sm:gap-3">
          {/* Identidad */}
          <div className="flex items-center space-x-2.5 sm:space-x-3.5 min-w-0">
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-amber-500 bg-black p-0.5 shrink-0">
              <img
                src="/logo.jpg"
                alt="Caseritos Burguer"
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="text-sm sm:text-xl font-black tracking-tight bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent whitespace-nowrap">
                  CASERITOS
                </span>
                <span className="text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  Admin
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-zinc-400 truncate max-w-[155px] sm:max-w-xs">
                {user?.email ? user.email : 'Gestión del Menú'}
              </p>
            </div>
          </div>

          {/* Acciones de Cabecera (táctiles >= 40px, sin colisiones en 390px) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <Link
              href="/"
              target="_blank"
              aria-label="Ver tienda pública"
              className="flex items-center justify-center space-x-1.5 min-w-[40px] min-h-[40px] px-2.5 sm:px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold transition whitespace-nowrap"
              title="Abrir vista pública del cliente"
            >
              <ExternalLink className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="hidden lg:inline">Ver Tienda</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsPhoneModalOpen(true)}
              aria-label="Configurar WhatsApp"
              className="hidden sm:flex items-center space-x-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition whitespace-nowrap"
              title="Configurar número de WhatsApp para pedidos"
            >
              <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden md:inline">+{currentPhone}</span>
              <span className="md:hidden">WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="hidden sm:flex items-center space-x-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-600/30 transition whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Nuevo Producto</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              aria-label="Cerrar sesión"
              className="flex items-center justify-center space-x-1.5 min-w-[40px] min-h-[40px] px-2.5 sm:px-3.5 py-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-700/50 text-red-300 text-xs sm:text-sm font-bold transition whitespace-nowrap"
              title="Cerrar sesión de administrador"
            >
              <LogOut className="w-4 h-4 text-red-400 shrink-0" />
              <span className="hidden md:inline">
                {isLoggingOut ? 'Saliendo...' : 'Salir'}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal del Dashboard */}
      <main className="flex-1 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 w-full space-y-5 sm:space-y-7">
        {/* Acciones Rápidas Móviles (< sm) */}
        <div className="grid grid-cols-2 gap-2.5 sm:hidden">
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center justify-center space-x-2 min-h-[44px] px-3 py-2.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold shadow-lg shadow-orange-600/30 transition active:scale-95"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Nuevo Producto</span>
          </button>

          <button
            type="button"
            onClick={() => setIsPhoneModalOpen(true)}
            className="flex items-center justify-center space-x-2 min-h-[44px] px-3 py-2.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition active:scale-95"
          >
            <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">WhatsApp</span>
          </button>
        </div>

        {/* Tarjetas de Estadísticas Rápidas (2x2 compacto en móvil, 4 cols en desktop) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 sm:p-5 flex items-center space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-orange-400 shrink-0">
              <Package className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-zinc-400 font-medium truncate">Total Menú</p>
              <p className="text-xl sm:text-2xl font-black text-white leading-tight">
                {products.length}
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 sm:p-5 flex items-center space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-zinc-400 font-medium truncate">
                Disponibles
              </p>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 leading-tight">
                {availableCount}
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 sm:p-5 flex items-center space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-zinc-400 font-medium truncate">Agotados</p>
              <p className="text-xl sm:text-2xl font-black text-red-400 leading-tight">
                {outOfStockCount}
              </p>
            </div>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-3.5 sm:p-5 flex items-center space-x-3 sm:space-x-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Database className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs text-zinc-400 font-medium truncate">Estado</p>
              <p className="text-xs sm:text-sm font-bold text-amber-400 truncate mt-0.5">
                {isFirebaseConfigured() ? 'Firebase Cloud' : 'Sync Servidor'}
              </p>
              <p className="text-[10px] sm:text-[11px] text-zinc-500 truncate">Km 13.5 • Gs.</p>
            </div>
          </div>
        </div>

        {/* Controles de Búsqueda y Filtro */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 sm:p-5">
          <div>
            <h2 className="text-lg sm:text-xl font-black text-white">Gestión del Menú</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Activa o agota productos, edita precios en Gs. o sube nuevas fotos
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-amber-500 text-white placeholder-zinc-500"
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

        <CategoryFilter
          categories={CATEGORIES}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
        />

        {/* Lista de Productos para Administrar */}
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-zinc-500 space-y-3">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium">Cargando catálogo de productos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-14 text-center bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 max-w-lg mx-auto">
            <p className="text-base font-bold text-white">No se encontraron productos</p>
            <p className="text-xs text-zinc-400 mt-1">
              Puedes agregar un nuevo producto o cambiar el filtro de búsqueda.
            </p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-4 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition"
            >
              Crear Nuevo Producto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`bg-zinc-900/90 border rounded-2xl overflow-hidden shadow-lg flex flex-col transition ${
                  product.available
                    ? 'border-zinc-800 hover:border-amber-500/50'
                    : 'border-red-900/60 bg-zinc-900/60'
                }`}
              >
                {/* Imagen */}
                <div className="relative aspect-[16/10] sm:aspect-[4/3] w-full bg-zinc-950 overflow-hidden">
                  <img
                    src={product.imageUrl || getCategoryPresetImage(product.category)}
                    alt={product.name}
                    onError={(e) => {
                      const target = e.currentTarget;
                      const fallback = getCategoryPresetImage(product.category);
                      if (target.src !== fallback) target.src = fallback;
                    }}
                    className={`w-full h-full object-cover transition ${
                      product.available ? '' : 'opacity-60 grayscale-[35%]'
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-65" />

                  <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5">
                    {product.isPopular && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500 text-zinc-950">
                        <Flame className="w-3 h-3" />
                        <span>Destacado</span>
                      </span>
                    )}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        product.available
                          ? 'bg-emerald-600/90 text-white'
                          : 'bg-red-600/95 text-white'
                      }`}
                    >
                      {product.available ? 'Disponible' : 'Agotado'}
                    </span>
                  </div>

                  <div className="absolute bottom-2.5 right-2.5 bg-zinc-950/90 border border-zinc-700 px-3 py-1 rounded-xl">
                    <span className="text-sm font-black text-amber-400">
                      {formatGuaranies(product.price)}
                    </span>
                  </div>
                </div>

                {/* Detalles */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                      {getCategoryLabel(product.category)}
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">{product.name}</h3>
                    <p className="mt-1 text-xs text-zinc-400 line-clamp-2">
                      {product.description}
                    </p>
                  </div>

                  {/* Controles CRUD (táctiles >= 40px para celular) */}
                  <div className="mt-4 pt-3 border-t border-zinc-800 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleAvailability(product)}
                        className={`flex items-center justify-center space-x-1.5 min-h-[40px] px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                          product.available
                            ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/50'
                            : 'bg-red-950/40 border border-red-500/40 text-red-400 hover:bg-red-900/50'
                        }`}
                        title="Alternar disponibilidad"
                      >
                        <Power className="w-3.5 h-3.5 shrink-0" />
                        <span>{product.available ? 'Activo' : 'Agotado'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(product)}
                        className="flex-1 flex items-center justify-center space-x-1.5 min-h-[40px] px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-xs font-bold transition"
                      >
                        <Edit className="w-3.5 h-3.5 shrink-0" />
                        <span>Editar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingProductId(product.id)}
                        aria-label={`Eliminar ${product.name}`}
                        className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-red-950/60 border border-zinc-700 hover:border-red-700/60 text-zinc-400 hover:text-red-400 transition shrink-0"
                        title="Eliminar producto"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {deletingProductId === product.id && (
                      <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-700/50 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in">
                        <span className="text-red-300 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>¿Eliminar producto?</span>
                        </span>
                        <div className="flex items-center space-x-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleQuickDelete(product.id)}
                            className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold"
                          >
                            Sí, borrar
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingProductId(null)}
                            className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modales de Gestión CRUD y Configuración */}
      <AdminProductModal
        products={products}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onProductsUpdated={setProducts}
      />

      <EditProductModal
        product={editingProduct}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingProduct(null);
        }}
        onProductUpdated={handleProductUpdated}
        onProductDeleted={handleProductDeleted}
      />

      <PhoneSettingsModal
        isOpen={isPhoneModalOpen}
        onClose={() => setIsPhoneModalOpen(false)}
        onPhoneUpdated={(phone) => {
          setCurrentPhone(phone);
          showToast(`WhatsApp actualizado a +${phone}`);
        }}
      />
    </div>
  );
}
