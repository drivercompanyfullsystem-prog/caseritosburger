export type ProductCategoryId =
  | 'hamburguesas'
  | 'papas_entradas'
  | 'bebidas'
  | 'postres'
  | 'combos'
  | 'guarniciones'
  | 'agregados';

export type ImageSourceType = 'manual_upload' | 'ai_generated' | 'category_preset';

export interface CategoryOption {
  id: ProductCategoryId;
  label: string;
  shortLabel: string;
  icon: string;
  presetImageUrl: string;
  aiVariants: string[];
}

/**
 * Categorías estructuradas principales para el selector de creación/edición de productos
 * en el panel de administración (/admin/dashboard).
 */
export const ADMIN_CATEGORY_OPTIONS: CategoryOption[] = [
  {
    id: 'hamburguesas',
    label: 'Hamburguesas 🍔',
    shortLabel: 'Hamburguesas',
    icon: '🍔',
    presetImageUrl:
      'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=85',
    aiVariants: [
      'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1553979459-d2229ba7433b?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1572802419224-296b0aeee0d9?auto=format&fit=crop&w=1200&q=85',
    ],
  },
  {
    id: 'papas_entradas',
    label: 'Papas & Entradas 🍟',
    shortLabel: 'Papas & Entradas',
    icon: '🍟',
    presetImageUrl:
      'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=1200&q=85',
    aiVariants: [
      'https://images.unsplash.com/photo-1630384060421-cb20d0e0649d?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1585109649139-366815a0d713?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=1200&q=85',
    ],
  },
  {
    id: 'bebidas',
    label: 'Bebidas 🥤',
    shortLabel: 'Bebidas',
    icon: '🥤',
    presetImageUrl:
      'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=1200&q=85',
    aiVariants: [
      'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1581006852262-e4307cf6283a?auto=format&fit=crop&w=1200&q=85',
    ],
  },
  {
    id: 'postres',
    label: 'Postres 🍦',
    shortLabel: 'Postres',
    icon: '🍦',
    presetImageUrl:
      'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=1200&q=85',
    aiVariants: [
      'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=1200&q=85',
    ],
  },
  {
    id: 'combos',
    label: 'Combos & Promos 📦',
    shortLabel: 'Combos & Promos',
    icon: '📦',
    presetImageUrl:
      'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=1200&q=85',
    aiVariants: [
      'https://images.unsplash.com/photo-1561758033-d89a9ad46330?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1200&q=85',
      'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=1200&q=85',
    ],
  },
  {
    id: 'agregados',
    label: 'Agregados Extras 🧀',
    shortLabel: 'Agregados Extras',
    icon: '🧀',
    presetImageUrl: '/menu/agregado-cheddar.jpg?v=fhd2',
    aiVariants: [
      '/menu/agregado-bacon.jpg?v=fhd2',
      '/menu/agregado-carne.jpg?v=fhd2',
      '/menu/agregado-cebolla.jpg?v=fhd2',
    ],
  },
];

/**
 * Diccionario de URLs estables en alta resolución (estilo gastronómico profesional)
 * por categoría para garantizar que ningún producto quede sin foto.
 */
export const CATEGORY_PRESET_IMAGES: Record<ProductCategoryId, string> = {
  hamburguesas:
    'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1200&q=85',
  papas_entradas:
    'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=1200&q=85',
  guarniciones:
    'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=1200&q=85',
  bebidas:
    'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=1200&q=85',
  postres:
    'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=1200&q=85',
  combos:
    'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=1200&q=85',
  agregados: '/menu/agregado-cheddar.jpg?v=fhd2',
};

export const CATEGORY_LABELS: Record<ProductCategoryId, string> = {
  hamburguesas: 'Hamburguesas 🍔',
  papas_entradas: 'Papas & Entradas 🍟',
  guarniciones: 'Papas & Entradas 🍟',
  bebidas: 'Bebidas 🥤',
  postres: 'Postres 🍦',
  combos: 'Combos & Promos 📦',
  agregados: 'Agregados Extras 🧀',
};

export function normalizeCategoryForForm(category: string): ProductCategoryId {
  if (category === 'guarniciones') return 'papas_entradas';
  if (
    category === 'hamburguesas' ||
    category === 'papas_entradas' ||
    category === 'bebidas' ||
    category === 'postres' ||
    category === 'combos' ||
    category === 'agregados'
  ) {
    return category;
  }
  return 'hamburguesas';
}

export function getCategoryPresetImage(category: string): string {
  const key = normalizeCategoryForForm(category);
  return CATEGORY_PRESET_IMAGES[key] || CATEGORY_PRESET_IMAGES.hamburguesas;
}

export function getCategoryLabel(category: string): string {
  const key = normalizeCategoryForForm(category);
  return CATEGORY_LABELS[key] || 'Hamburguesas 🍔';
}

export function matchesCategoryFilter(productCategory: string, activeFilter: string): boolean {
  if (activeFilter === 'all') return true;
  if (activeFilter === 'papas_entradas' || activeFilter === 'guarniciones') {
    return productCategory === 'papas_entradas' || productCategory === 'guarniciones';
  }
  return productCategory === activeFilter;
}
