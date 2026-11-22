'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Trash2,
  Upload,
  AlertTriangle,
  Sparkles,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Product } from '../types';
import { updateProduct, deleteProduct, uploadProductImage } from '../lib/firebase';
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
  normalizeCategoryForForm,
} from '../constants/categories';

interface EditProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onProductUpdated: (updatedProduct: Product) => void;
  onProductDeleted: (deletedId: string) => void;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  product,
  isOpen,
  onClose,
  onProductUpdated,
  onProductDeleted,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<ProductCategoryId>('hamburguesas');

  // Estados de lógica híbrida de imagen
  const [imageUrl, setImageUrl] = useState('');
  const [imageSource, setImageSource] = useState<ImageSourceType>('category_preset');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [manualPreviewUrl, setManualPreviewUrl] = useState<string | null>(null);
  const [aiImageUrl, setAiImageUrl] = useState<string | null>(null);
  const [aiAttempt, setAiAttempt] = useState(0);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);

  const [available, setAvailable] = useState(true);
  const [isPopular, setIsPopular] = useState(false);
  const [tags, setTags] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (product) {
      setName(product.name);
      setDescription(product.description);
      setPrice(formatGuaraniesInput(product.price.toString()));
      setCategory(normalizeCategoryForForm(product.category));
      setImageUrl(product.imageUrl || getCategoryPresetImage(product.category));
      setImageSource(product.imageSource || 'category_preset');
      setAvailable(product.available);
      setIsPopular(Boolean(product.isPopular));
      setTags(product.tags ? product.tags.join(', ') : '');
      setImageFile(null);
      setAiImageUrl(null);
      setAiAttempt(0);
      setShowDeleteConfirm(false);
      setMessage('');
    }
  }, [product, isOpen]);

  useEffect(() => {
    if (!imageFile) {
      setManualPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setManualPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  if (!isOpen || !product) return null;

  const activeImageSource: ImageSourceType = imageFile
    ? 'manual_upload'
    : aiImageUrl
    ? 'ai_generated'
    : imageSource;

  const activePreviewUrl: string =
    manualPreviewUrl || aiImageUrl || imageUrl || getCategoryPresetImage(category);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
      setMessage('');
    }
  };

  const handleGenerateAiImage = async () => {
    if (!name.trim()) {
      setMessage('Por favor escribe el nombre del producto antes de generar la imagen con IA.');
      return;
    }

    setIsGeneratingImage(true);
    setMessage('');

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

      setImageFile(null);
      setAiImageUrl(data.imageUrl);
      setImageSource('ai_generated');
    } catch (err: any) {
      setMessage('Error al generar con IA: ' + (err?.message || 'Intenta nuevamente.'));
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDiscardAiImage = () => {
    setAiImageUrl(null);
    setImageUrl(getCategoryPresetImage(category));
    setImageSource('category_preset');
  };

  const handleUseCategoryPreset = () => {
    setImageFile(null);
    setAiImageUrl(null);
    setImageUrl(getCategoryPresetImage(category));
    setImageSource('category_preset');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericPrice = parseGuaraniesInput(price);
    if (!name.trim() || numericPrice <= 0 || !description.trim()) return;

    setIsSaving(true);
    setMessage('Guardando cambios...');

    try {
      let finalImageUrl = imageUrl || getCategoryPresetImage(category);
      let finalImageSource: ImageSourceType = imageSource;

      if (imageFile) {
        setMessage('Subiendo nueva imagen a Firebase Storage...');
        finalImageUrl = await uploadProductImage(imageFile);
        finalImageSource = 'manual_upload';
      } else if (aiImageUrl) {
        finalImageUrl = aiImageUrl;
        finalImageSource = 'ai_generated';
      } else if (!finalImageUrl.trim()) {
        finalImageUrl = getCategoryPresetImage(category);
        finalImageSource = 'category_preset';
      }

      const parsedTags = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const updated = await updateProduct(product.id, {
        name: name.trim(),
        description: description.trim(),
        price: numericPrice,
        category,
        imageUrl: finalImageUrl,
        imageSource: finalImageSource,
        available,
        isPopular,
        tags: parsedTags,
      });

      onProductUpdated(updated);
      setMessage('¡Guardado con éxito!');
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (err: any) {
      setMessage('Error al guardar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsSaving(true);
    try {
      await deleteProduct(product.id);
      onProductDeleted(product.id);
      onClose();
    } catch (err: any) {
      setMessage('Error al eliminar: ' + err.message);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="relative bg-zinc-950 border-t sm:border border-zinc-800 rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[90vh] text-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-800 flex items-center justify-between gap-2 bg-zinc-900/60 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base sm:text-xl font-bold truncate">
              ✏️ Editar Producto
            </h3>
            <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 truncate">
              Modifica precio, descripción, categoría y foto
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar edición"
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de estado */}
        {message && (
          <div className="mx-4 sm:mx-6 mt-3 p-3 bg-amber-950/40 border border-amber-600/40 rounded-xl text-xs text-amber-200 shrink-0">
            {message}
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSave} className="flex-1 px-4 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto dark-scrollbar">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Nombre del Producto *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white"
              required
            />
          </div>

          {/* Precio y Categoría */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Precio en Guaraníes (PYG) *
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-amber-400 font-black select-none">
                  Gs.
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ej: 38.000"
                  value={price}
                  onChange={(e) => setPrice(formatGuaraniesInput(e.target.value))}
                  className="w-full pl-11 pr-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-amber-400 font-bold"
                  required
                />
              </div>
              {parseGuaraniesInput(price) > 0 && (
                <p className="text-[11px] text-zinc-400 mt-1">
                  Se verá como:{' '}
                  <strong className="text-amber-400">
                    {formatGuaranies(parseGuaraniesInput(price))}
                  </strong>
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
                Categoría *
              </label>
              <select
                value={category}
                onChange={(e) => {
                  const newCat = e.target.value as ProductCategoryId;
                  setCategory(newCat);
                  if (activeImageSource === 'category_preset') {
                    setImageUrl(getCategoryPresetImage(newCat));
                  }
                }}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white"
              >
                {ADMIN_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Descripción e Ingredientes *
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm focus:outline-none focus:border-orange-500 text-white resize-none"
              required
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-1">
              Etiquetas (separadas por comas)
            </label>
            <input
              type="text"
              placeholder="Ej: Pan Brioche, Doble Carne, Smash"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full px-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs focus:outline-none focus:border-orange-500 text-white"
            />
          </div>

          {/* Imagen Híbrida (Manual + IA + Preset) */}
          <div className="p-4 bg-zinc-900/70 border border-zinc-800 rounded-2xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Foto del Producto
                </label>
                <p className="text-[11px] text-zinc-400">
                  Carga manual prioritaria, generación con IA o preset de categoría
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateAiImage}
                disabled={isGeneratingImage}
                className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 min-h-[40px] px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-orange-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 disabled:opacity-60 text-white text-xs font-bold shadow-md transition"
              >
                {isGeneratingImage ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{aiImageUrl ? 'Volver a generar con IA' : 'Generar imagen con IA'}</span>
              </button>
            </div>

            {isGeneratingImage && (
              <div className="p-3 bg-purple-950/40 border border-purple-500/40 rounded-xl flex items-center space-x-3 text-xs text-purple-200">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                <span>
                  Creando imagen gastronómica para <strong>{getCategoryLabel(category)}</strong>...
                </span>
              </div>
            )}

            <div className="relative rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950 aspect-[16/10]">
              <img
                src={activePreviewUrl}
                alt={name || 'Vista previa'}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/30" />

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
                {activeImageSource !== 'category_preset' && !aiImageUrl && (
                  <button
                    type="button"
                    onClick={handleUseCategoryPreset}
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-[11px] font-semibold transition"
                  >
                    Usar preset de categoría
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5 flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-orange-400" />
                <span>Subir archivo local a Firebase Storage (tiene prioridad):</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="w-full text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer"
              />
            </div>
          </div>

          {/* Disponibilidad y Destacado */}
          <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-sm font-bold text-white block">Disponibilidad</span>
                <span className="text-xs text-zinc-400">
                  {available
                    ? 'Activo en el menú público'
                    : 'Agotado (no se puede pedir)'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAvailable(!available)}
                className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 ${
                  available
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-red-600/20 text-red-400 border border-red-500/40'
                }`}
              >
                {available ? 'Disponible' : 'Agotado'}
              </button>
            </div>

            <div className="flex items-center space-x-2 pt-2 border-t border-zinc-800">
              <input
                type="checkbox"
                id="edit-popular"
                checked={isPopular}
                onChange={(e) => setIsPopular(e.target.checked)}
                className="w-4 h-4 accent-orange-500 rounded"
              />
              <label htmlFor="edit-popular" className="text-xs text-zinc-300">
                Marcar como Producto Favorito / Destacado
              </label>
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={isSaving || isGeneratingImage}
              className="w-full sm:flex-1 py-3.5 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-60 text-white font-bold text-sm shadow-lg shadow-orange-600/30 transition flex items-center justify-center space-x-2"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>

            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full sm:w-auto px-4 py-3.5 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-700/50 text-red-400 text-xs font-bold transition flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar</span>
              </button>
            ) : (
              <div className="flex items-center space-x-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="flex-1 sm:flex-none px-4 py-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition flex items-center justify-center space-x-1"
                >
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Confirmar Borrado</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-3.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
