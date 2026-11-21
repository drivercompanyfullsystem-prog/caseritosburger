'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Plus,
  Sparkles,
  RefreshCw,
  Trash2,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { Product } from '../types';
import {
  createProduct,
  uploadProductImage,
  toggleProductAvailability,
  isFirebaseConfigured,
} from '../lib/firebase';
import {
  formatGuaranies,
  formatGuaraniesInput,
  parseGuaraniesInput,
} from '../utils/whatsapp';
import {
  ADMIN_CATEGORY_OPTIONS,
  ImageSourceType,
  ProductCategoryId,
  getCategoryLabel,
  getCategoryPresetImage,
} from '../constants/categories';

interface AdminProductModalProps {
  products: Product[];
  isOpen: boolean;
  onClose: () => void;
  onProductsUpdated: (products: Product[]) => void;
}

export const AdminProductModal: React.FC<AdminProductModalProps> = ({
  products,
  isOpen,
  onClose,
  onProductsUpdated,
}) => {
  const [tab, setTab] = useState<'create' | 'manage'>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<ProductCategoryId>('hamburguesas');

  // Estados de lógica híbrida de imagen
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [manualPreviewUrl, setManualPreviewUrl] = useState<string | null>(null);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [aiAttempt, setAiAttempt] = useState(0);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const [isPopular, setIsPopular] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Limpiar ObjectURL temporal cuando cambie el archivo manual
  useEffect(() => {
    if (!imageFile) {
      setManualPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setManualPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  if (!isOpen) return null;

  // Prioridad híbrida: 1) Carga manual -> 2) Generada con IA -> 3) Preset automático por categoría
  const activeImageSource: ImageSourceType = imageFile
    ? 'manual_upload'
    : aiImageUrl
    ? 'ai_generated'
    : 'category_preset';

  const activePreviewUrl: string =
    manualPreviewUrl || aiImageUrl || getCategoryPresetImage(category);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setStatusMessage('');
    }
  };

  const handleClearManualFile = () => {
    setImageFile(null);
  };

  const handleGenerateAiImage = async () => {
    if (!name.trim()) {
      setStatusMessage('Por favor escribe primero el nombre del producto para generar su imagen con IA.');
      return;
    }

    setIsGeneratingImage(true);
    setStatusMessage('');

    try {
      const nextAttempt = aiAttempt + 1;
      setAiAttempt(nextAttempt);

      const response = await fetch('/api/admin/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          category,
          attempt: nextAttempt,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo generar la imagen con IA.');
      }

      // Al generar con IA, si había archivo manual lo limpiamos para mostrar la imagen IA
      setImageFile(null);
      setAiImageUrl(data.imageUrl);
    } catch (err: any) {
      setStatusMessage('Error al generar imagen con IA: ' + (err?.message || 'Intenta nuevamente.'));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDiscardAiImage = () => {
    setAiImageUrl(null);
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = parseGuaraniesInput(price);
    if (!name.trim() || numericPrice <= 0 || !description.trim()) return;

    setIsSubmitting(true);
    setStatusMessage('Guardando producto...');

    try {
      let finalImageUrl = getCategoryPresetImage(category);
      let finalImageSource: ImageSourceType = 'category_preset';

      if (imageFile) {
        setStatusMessage('Subiendo imagen manual a Firebase Storage...');
        finalImageUrl = await uploadProductImage(imageFile);
        finalImageSource = 'manual_upload';
      } else if (aiImageUrl) {
        finalImageUrl = aiImageUrl;
        finalImageSource = 'ai_generated';
      }

      const newProd = await createProduct({
        name: name.trim(),
        description: description.trim(),
        price: numericPrice,
        category,
        imageUrl: finalImageUrl,
        imageSource: finalImageSource,
        available: true,
        isPopular,
      });

      onProductsUpdated([newProd, ...products]);
      setName('');
      setDescription('');
      setPrice('');
      setImageFile(null);
      setAiImageUrl(null);
      setAiAttempt(0);
      setIsPopular(false);
      setStatusMessage('¡Producto creado con éxito!');
      setTimeout(() => setStatusMessage(''), 3000);
      setTab('manage');
    } catch (err: any) {
      setStatusMessage('Error al crear el producto: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (prod: Product) => {
    const updatedStatus = await toggleProductAvailability(prod.id, prod.available);
    const updatedList = products.map((p) =>
      p.id === prod.id ? { ...p, available: updatedStatus } : p
    );
    onProductsUpdated(updatedList);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="relative bg-zinc-950 border border-zinc-800 rounded-3xl max-w-xl w-full text-white shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold flex items-center space-x-2">
              <span>⚙️ Panel de Gestión de Menú</span>
            </h3>
            <p className="text-xs text-zinc-400 mt-1">
              {isFirebaseConfigured() ? (
                <span className="text-emerald-400 flex items-center gap-1">
                  ● Conectado con Firebase Firestore & Storage
                </span>
              ) : (
                <span className="text-amber-400 flex items-center gap-1">
                  ● Modo Local Activo (Sincronización inmediata en navegador)
                </span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/50">
          <button
            onClick={() => setTab('create')}
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold transition ${
              tab === 'create'
                ? 'text-orange-400 border-b-2 border-orange-500 bg-zinc-900'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            + Agregar Nuevo Producto
          </button>
          <button
            onClick={() => setTab('manage')}
            className={`flex-1 py-3 text-xs sm:text-sm font-semibold transition ${
              tab === 'manage'
                ? 'text-orange-400 border-b-2 border-orange-500 bg-zinc-900'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Disponibilidad ({products.length})
          </button>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {statusMessage && (
            <div className="mb-4 p-3 bg-orange-950/40 border border-orange-600/40 rounded-xl text-xs text-orange-200">
              {statusMessage}
            </div>
          )}

          {tab === 'create' ? (
            <form onSubmit={handleCreateProduct} className="space-y-4">
              {/* Nombre y Selector de Categoría + Botón IA */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Doble Bacon Caseritos"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Categoría *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ProductCategoryId)}
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white"
                    >
                      {ADMIN_CATEGORY_OPTIONS.slice(0, 5).map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Precio en Guaraníes (PYG) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-amber-400 select-none">
                        Gs.
                      </span>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej: 38.000"
                        value={price}
                        onChange={(e) => setPrice(formatGuaraniesInput(e.target.value))}
                        className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm font-bold focus:outline-none focus:border-orange-500 text-amber-300"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Descripción e Ingredientes *
                </label>
                <textarea
                  rows={2}
                  placeholder="Ej: Doble medallón casero de 100g, pan artesanal, cheddar fundido y bacon ahumado..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white resize-none"
                  required
                />
              </div>

              {/* Sección de Imagen Híbrida (Manual + IA + Preset de Categoría) */}
              <div className="p-4 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wider">
                      Fotografía del Producto
                    </label>
                    <p className="text-[11px] text-zinc-400">
                      Sube una foto propia, genérala con IA o usa el preset de categoría
                    </p>
                  </div>

                  {/* Botón Generar imagen con IA */}
                  <button
                    type="button"
                    onClick={handleGenerateAiImage}
                    disabled={isGeneratingImage}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-orange-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 disabled:opacity-60 text-white text-xs font-bold shadow-md transition"
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {aiImageUrl ? 'Volver a generar con IA' : 'Generar imagen con IA'}
                    </span>
                  </button>
                </div>

                {/* Estado de carga interactivo de IA */}
                {isGeneratingImage && (
                  <div className="p-3 bg-purple-950/40 border border-purple-500/40 rounded-xl flex items-center space-x-3 text-xs text-purple-200">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                    <span>
                      Creando imagen gastronómica para <strong>{getCategoryLabel(category)}</strong>...
                    </span>
                  </div>
                )}

                {/* Preview inmediato de la imagen */}
                <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 aspect-[16/10]">
                  <img
                    src={activePreviewUrl}
                    alt={name || 'Preview del producto'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />

                  {/* Etiqueta del origen actual de la imagen */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                    {activeImageSource === 'manual_upload' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600/95 text-white shadow">
                        📁 Carga Manual (Prioritaria)
                      </span>
                    )}
                    {activeImageSource === 'ai_generated' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-600/95 text-white shadow">
                        ✨ Generada con IA
                      </span>
                    )}
                    {activeImageSource === 'category_preset' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-900/90 border border-zinc-700 text-amber-300 shadow">
                        📸 Preset: {getCategoryLabel(category)}
                      </span>
                    )}
                  </div>

                  {/* Controles para descartar o regenerar imagen IA / manual */}
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2">
                    {activeImageSource === 'ai_generated' && (
                      <>
                        <button
                          type="button"
                          onClick={handleGenerateAiImage}
                          disabled={isGeneratingImage}
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-amber-300 text-[11px] font-semibold flex items-center gap-1 transition"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Otra toma</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleDiscardAiImage}
                          className="px-2.5 py-1.5 rounded-lg bg-red-950/90 hover:bg-red-900 border border-red-700/60 text-red-200 text-[11px] font-semibold flex items-center gap-1 transition"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Descartar IA</span>
                        </button>
                      </>
                    )}
                    {activeImageSource === 'manual_upload' && (
                      <button
                        type="button"
                        onClick={handleClearManualFile}
                        className="px-2.5 py-1.5 rounded-lg bg-red-950/90 hover:bg-red-900 border border-red-700/60 text-red-200 text-[11px] font-semibold flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Quitar archivo</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Input de carga manual prioritaria */}
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-orange-400" />
                    <span>Subir archivo local a Firebase Storage (tiene prioridad):</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="w-full text-xs text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="popular"
                  checked={isPopular}
                  onChange={(e) => setIsPopular(e.target.checked)}
                  className="w-4 h-4 accent-orange-500 rounded"
                />
                <label htmlFor="popular" className="text-xs text-zinc-300">
                  Marcar como Producto Favorito / Destacado
                </label>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isGeneratingImage}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-60 text-white font-bold text-sm shadow-lg transition flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>{isSubmitting ? 'Guardando...' : 'Crear y Publicar en Menú'}</span>
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-zinc-400">
                Cambia la disponibilidad de los productos en tiempo real:
              </p>
              {products.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-10 h-10 rounded-lg object-cover bg-zinc-800 flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{p.name}</p>
                      <p className="text-[11px] text-amber-400">{formatGuaranies(p.price)}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggle(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      p.available
                        ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-600/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {p.available ? 'Disponible' : 'Agotado'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
