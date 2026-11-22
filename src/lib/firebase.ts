import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  collection,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  doc,
  query,
  onSnapshot,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';
import { Product } from '../types';
import { INITIAL_PRODUCTS } from '../data/mockProducts';
import { setBusinessWhatsAppPhone, normalizeParaguayPhone } from '../utils/whatsapp';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = (): boolean => {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let auth: Auth | undefined;

if (typeof window !== 'undefined' || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  try {
    if (isFirebaseConfigured()) {
      app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
      db = getFirestore(app);
      storage = getStorage(app);
      auth = getAuth(app);
    }
  } catch (err) {
    console.warn('Firebase initialization error, defaulting to local state:', err);
  }
}

export { app, db, storage, auth };

type FirestoreProductDoc = Partial<Product> & {
  id: string;
  deleted?: boolean;
  updatedAt?: number;
  createdAt?: number;
};

const SOLO_IMAGE_UPGRADES: Record<string, string> = {
  'burger-caseritos': '/menu/burger-caseritos-solo.jpg?v=fhd3',
  'burger-tradicional': '/menu/burger-tradicional-solo.jpg?v=fhd3',
  'burger-bacon': '/menu/burger-bacon-solo.jpg?v=fhd3',
  'burger-premium': '/menu/burger-premium-solo.jpg?v=fhd3',
};

const LEGACY_COMBO_IMAGES = new Set([
  '/menu/burger-caseritos.jpg?v=fhd2',
  '/menu/burger-tradicional.jpg?v=fhd2',
  '/menu/burger-bacon.jpg?v=fhd2',
  '/menu/burger-premium.jpg?v=fhd2',
]);

/**
 * Combina el catálogo base (INITIAL_PRODUCTS) con los documentos de Firestore.
 * Así cualquier cambio de "Agotado", precio o producto nuevo en Firestore se refleja
 * en todos los dispositivos sin perder los demás productos del catálogo base.
 */
function mergeProductsWithFirestore(docs: FirestoreProductDoc[]): Product[] {
  const byId = new Map<string, FirestoreProductDoc>();
  for (const d of docs) {
    if (d && d.id) {
      const prev = byId.get(d.id);
      if (!prev || (d.updatedAt || 0) >= (prev.updatedAt || 0)) {
        byId.set(d.id, d);
      }
    }
  }

  const merged: Product[] = [];
  const initialIds = new Set<string>();

  for (const base of INITIAL_PRODUCTS) {
    initialIds.add(base.id);
    const remote = byId.get(base.id);
    if (!remote) {
      merged.push(base);
      continue;
    }
    if (remote.deleted) {
      continue;
    }

    // Si el doc remoto de una hamburguesa individual aún tenía la imagen vieja de combo, usar la foto individual nueva
    let resolvedImageUrl = remote.imageUrl || base.imageUrl;
    if (
      SOLO_IMAGE_UPGRADES[base.id] &&
      (!remote.imageUrl || LEGACY_COMBO_IMAGES.has(remote.imageUrl))
    ) {
      resolvedImageUrl = SOLO_IMAGE_UPGRADES[base.id];
    }

    merged.push({
      ...base,
      ...remote,
      id: base.id,
      name: remote.name ?? base.name,
      description: remote.description ?? base.description,
      price: typeof remote.price === 'number' ? remote.price : base.price,
      category: remote.category ?? base.category,
      imageUrl: resolvedImageUrl,
      available: typeof remote.available === 'boolean' ? remote.available : base.available,
    });
  }

  // Agregar productos nuevos creados por el administrador que no están en INITIAL_PRODUCTS
  const customProducts: Array<Product & { createdAt?: number }> = [];
  for (const remote of docs) {
    if (!remote || !remote.id || initialIds.has(remote.id) || remote.deleted) continue;
    if (!remote.name || typeof remote.price !== 'number') continue;
    customProducts.push({
      id: remote.id,
      name: remote.name,
      description: remote.description || '',
      price: remote.price,
      comboPrice: remote.comboPrice,
      category: remote.category || 'hamburguesas',
      imageUrl: remote.imageUrl || '/menu/burger-caseritos-solo.jpg?v=fhd3',
      imageSource: remote.imageSource,
      available: typeof remote.available === 'boolean' ? remote.available : true,
      isPopular: Boolean(remote.isPopular),
      tags: Array.isArray(remote.tags) ? remote.tags : [],
      createdAt: remote.createdAt || 0,
    });
  }

  customProducts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return [...customProducts, ...merged];
}

function saveLocalCache(products: Product[]) {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('caceritos_products', JSON.stringify(products));
      localStorage.setItem('caceritos_products_v7', '7');
    } catch {
      // ignorar
    }
  }
}

function cleanUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) {
      out[key] = obj[key];
    }
  }
  return out;
}

async function fetchServerOverrides(): Promise<{
  overrides: FirestoreProductDoc[];
  whatsappPhone: string | null;
}> {
  if (typeof window === 'undefined') {
    return { overrides: [], whatsappPhone: null };
  }
  try {
    const res = await fetch('/api/products', { cache: 'no-store' });
    if (!res.ok) return { overrides: [], whatsappPhone: null };
    const data = (await res.json()) as {
      overrides?: FirestoreProductDoc[];
      whatsappPhone?: string | null;
    };
    return {
      overrides: Array.isArray(data.overrides) ? data.overrides : [],
      whatsappPhone: data.whatsappPhone || null,
    };
  } catch {
    return { overrides: [], whatsappPhone: null };
  }
}

async function pushServerOverride(payload: {
  override?: FirestoreProductDoc;
  whatsappPhone?: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignorar si falla red
  }
}

// Obtener productos (desde Firestore + respaldo del servidor /api/products + localStorage)
export async function fetchProducts(): Promise<Product[]> {
  const collectedDocs: FirestoreProductDoc[] = [];

  if (db) {
    try {
      const q = query(collection(db, 'products'));
      const snapshot = await getDocs(q);
      for (const docSnap of snapshot.docs) {
        collectedDocs.push({
          ...(docSnap.data() as Partial<Product>),
          id: docSnap.id,
        });
      }
    } catch (e) {
      console.warn('Could not read from Firestore, falling back to server/local data:', e);
    }
  }

  const serverData = await fetchServerOverrides();
  if (serverData.overrides.length > 0) {
    collectedDocs.push(...serverData.overrides);
  }
  if (serverData.whatsappPhone) {
    setBusinessWhatsAppPhone(serverData.whatsappPhone);
  }

  if (collectedDocs.length > 0 || db) {
    const merged = mergeProductsWithFirestore(collectedDocs);
    saveLocalCache(merged);
    return merged;
  }

  if (typeof window !== 'undefined') {
    const schemaVersion = localStorage.getItem('caceritos_products_v7');
    const cached = localStorage.getItem('caceritos_products');
    if (cached && schemaVersion === '7') {
      try {
        return JSON.parse(cached);
      } catch {
        // fallback
      }
    }
    saveLocalCache(INITIAL_PRODUCTS);
  }

  return INITIAL_PRODUCTS;
}

/**
 * Suscripción en tiempo real a los productos de Firestore (más sincronización con /api/products).
 * Cuando el admin marca un producto como "Agotado" o edita un precio,
 * todos los celulares conectados reciben el cambio al instante.
 */
export function subscribeToProducts(onUpdate: (products: Product[]) => void): () => void {
  let isActive = true;

  const refreshAll = async () => {
    const prods = await fetchProducts();
    if (isActive) onUpdate(prods);
  };

  refreshAll();

  // Revalidar al volver a enfocar la pestaña/celular
  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      refreshAll();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('focus', refreshAll);
    document.addEventListener('visibilitychange', handleVisibility);
  }

  let unsubscribeFirestore: (() => void) | null = null;
  if (db) {
    const q = query(collection(db, 'products'));
    unsubscribeFirestore = onSnapshot(
      q,
      async (snapshot) => {
        const docs: FirestoreProductDoc[] = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as Partial<Product>),
          id: docSnap.id,
        }));
        const serverData = await fetchServerOverrides();
        if (serverData.overrides.length > 0) {
          docs.push(...serverData.overrides);
        }
        const merged = mergeProductsWithFirestore(docs);
        saveLocalCache(merged);
        if (isActive) onUpdate(merged);
      },
      (err) => {
        console.warn('Realtime Firestore products listener fallback:', err);
        refreshAll();
      }
    );
  }

  return () => {
    isActive = false;
    if (unsubscribeFirestore) unsubscribeFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', refreshAll);
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  };
}

/** Sincroniza el teléfono de WhatsApp del negocio en Firestore y servidor para todos los clientes. */
export async function saveBusinessPhoneToCloud(rawPhone: string): Promise<string> {
  const normalized = normalizeParaguayPhone(rawPhone);
  setBusinessWhatsAppPhone(normalized);
  await pushServerOverride({ whatsappPhone: normalized });
  if (db) {
    try {
      await setDoc(
        doc(db, 'settings', 'store'),
        { whatsappPhone: normalized, updatedAt: Date.now() },
        { merge: true }
      );
    } catch (e) {
      console.warn('No se pudo guardar el teléfono en Firestore:', e);
    }
  }
  return normalized;
}

export async function fetchBusinessPhoneFromCloud(): Promise<string | null> {
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'settings', 'store'));
      if (snap.exists()) {
        const phone = (snap.data() as { whatsappPhone?: string })?.whatsappPhone;
        if (phone) {
          const normalized = normalizeParaguayPhone(phone);
          setBusinessWhatsAppPhone(normalized);
          return normalized;
        }
      }
    } catch {
      // ignorar
    }
  }
  const serverData = await fetchServerOverrides();
  if (serverData.whatsappPhone) {
    const normalized = normalizeParaguayPhone(serverData.whatsappPhone);
    setBusinessWhatsAppPhone(normalized);
    return normalized;
  }
  return null;
}

// Subir imagen a Firebase Storage o convertir a DataURL para almacenamiento local
export async function uploadProductImage(file: File): Promise<string> {
  if (storage) {
    try {
      const storageRef = ref(storage, `products/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      return await getDownloadURL(uploadResult.ref);
    } catch (e) {
      console.warn('Firebase Storage upload failed, converting to local Base64:', e);
    }
  }

  // Fallback: leer como base64 data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Guardar nuevo producto
export async function createProduct(product: Omit<Product, 'id'>): Promise<Product> {
  const newId = `prod-${Date.now()}`;
  const now = Date.now();
  const newProduct: Product = {
    ...product,
    id: newId,
  };
  const payload = cleanUndefined({
    ...newProduct,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  }) as FirestoreProductDoc;

  await pushServerOverride({ override: payload });

  if (db) {
    try {
      const docRef = doc(db, 'products', newId);
      await setDoc(docRef, payload);
    } catch (e) {
      console.error('Error guardando nuevo producto en Firestore:', e);
    }
  }

  if (typeof window !== 'undefined') {
    const existing = await fetchProducts();
    const withoutDup = existing.filter((p) => p.id !== newProduct.id);
    saveLocalCache([newProduct, ...withoutDup]);
  }

  return newProduct;
}

// Alternar disponibilidad ("Disponible" <-> "Agotado") sincronizado en Firestore + servidor
export async function toggleProductAvailability(
  id: string,
  currentStatus: boolean
): Promise<boolean> {
  const newStatus = !currentStatus;
  const currentList = await fetchProducts();
  const baseProduct =
    currentList.find((p) => p.id === id) || INITIAL_PRODUCTS.find((p) => p.id === id);
  const payload = cleanUndefined({
    ...(baseProduct || {}),
    id,
    available: newStatus,
    deleted: false,
    updatedAt: Date.now(),
  }) as FirestoreProductDoc;

  await pushServerOverride({ override: payload });

  if (db) {
    try {
      const docRef = doc(db, 'products', id);
      await setDoc(docRef, payload, { merge: true });
    } catch (e) {
      console.error('Error actualizando disponibilidad en Firestore:', e);
    }
  }

  const updated = currentList.map((p) => (p.id === id ? { ...p, available: newStatus } : p));
  saveLocalCache(updated);

  return newStatus;
}

// Actualizar cualquier campo de un producto (precio, descripción, nombre, imagen, etc.)
export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const currentList = await fetchProducts();
  const baseProduct =
    currentList.find((p) => p.id === id) || INITIAL_PRODUCTS.find((p) => p.id === id);
  const mergedProduct: Product = {
    ...(baseProduct || ({ id } as Product)),
    ...updates,
    id,
  };
  const payload = cleanUndefined({
    ...mergedProduct,
    deleted: false,
    updatedAt: Date.now(),
  }) as FirestoreProductDoc;

  await pushServerOverride({ override: payload });

  if (db) {
    try {
      const docRef = doc(db, 'products', id);
      await setDoc(docRef, payload, { merge: true });
    } catch (e) {
      console.error('Error actualizando producto en Firestore:', e);
    }
  }

  const updatedList = currentList.map((p) => (p.id === id ? mergedProduct : p));
  saveLocalCache(updatedList);
  return mergedProduct;
}

// Eliminar un producto (usa tombstone deleted:true para que tampoco reaparezca de INITIAL_PRODUCTS)
export async function deleteProduct(id: string): Promise<boolean> {
  const isBaseProduct = INITIAL_PRODUCTS.some((p) => p.id === id);
  const tombstone: FirestoreProductDoc = { id, deleted: true, updatedAt: Date.now() };

  await pushServerOverride({ override: tombstone });

  if (db) {
    try {
      const docRef = doc(db, 'products', id);
      if (isBaseProduct) {
        await setDoc(docRef, tombstone, { merge: true });
      } else {
        await deleteDoc(docRef);
      }
    } catch (e) {
      console.error('Error eliminando producto en Firestore:', e);
    }
  }

  const products = await fetchProducts();
  const updatedList = products.filter((p) => p.id !== id);
  saveLocalCache(updatedList);

  return true;
}
