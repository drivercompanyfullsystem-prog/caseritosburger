import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query } from 'firebase/firestore';
import { getStorage, FirebaseStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getAuth, Auth } from 'firebase/auth';
import { Product } from '../types';
import { INITIAL_PRODUCTS } from '../data/mockProducts';

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

// Obtener productos (desde Firestore o fallback a mock/localStorage)
export async function fetchProducts(): Promise<Product[]> {
  if (typeof window !== 'undefined') {
    const schemaVersion = localStorage.getItem('caceritos_products_v7');
    const cached = localStorage.getItem('caceritos_products');
    if (!isFirebaseConfigured()) {
      if (cached && schemaVersion === '7') {
        try {
          return JSON.parse(cached);
        } catch {
          // fallback
        }
      }
      localStorage.setItem('caceritos_products', JSON.stringify(INITIAL_PRODUCTS));
      localStorage.setItem('caceritos_products_v7', '7');
      return INITIAL_PRODUCTS;
    }
  }

  if (db) {
    try {
      const q = query(collection(db, 'products'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Product[];
      }
    } catch (e) {
      console.warn('Could not read from Firestore, falling back to local data:', e);
    }
  }

  return INITIAL_PRODUCTS;
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
  if (db) {
    try {
      const docRef = await addDoc(collection(db, 'products'), product);
      return { id: docRef.id, ...product };
    } catch (e) {
      console.warn('Firestore write failed, saving locally:', e);
    }
  }

  const newProduct: Product = {
    ...product,
    id: 'local-' + Date.now(),
  };

  if (typeof window !== 'undefined') {
    const existing = await fetchProducts();
    const updated = [newProduct, ...existing];
    localStorage.setItem('caceritos_products', JSON.stringify(updated));
  }

  return newProduct;
}

// Alternar disponibilidad
export async function toggleProductAvailability(id: string, currentStatus: boolean): Promise<boolean> {
  const newStatus = !currentStatus;
  if (db && !id.startsWith('local-') && !id.startsWith('prod-')) {
    try {
      const docRef = doc(db, 'products', id);
      await updateDoc(docRef, { available: newStatus });
      return newStatus;
    } catch (e) {
      console.warn('Error updating doc in Firestore:', e);
    }
  }

  if (typeof window !== 'undefined') {
    const products = await fetchProducts();
    const updated = products.map((p) => (p.id === id ? { ...p, available: newStatus } : p));
    localStorage.setItem('caceritos_products', JSON.stringify(updated));
  }

  return newStatus;
}

// Actualizar cualquier campo de un producto (precio, descripción, nombre, etc.)
export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  if (db && !id.startsWith('local-') && !id.startsWith('prod-')) {
    try {
      const docRef = doc(db, 'products', id);
      await updateDoc(docRef, updates as any);
    } catch (e) {
      console.warn('Error updating in Firestore, saving locally:', e);
    }
  }

  if (typeof window !== 'undefined') {
    const products = await fetchProducts();
    const updatedList = products.map((p) => (p.id === id ? { ...p, ...updates } : p));
    localStorage.setItem('caceritos_products', JSON.stringify(updatedList));
    const target = updatedList.find((p) => p.id === id);
    if (target) return target;
  }

  return { id, ...updates } as Product;
}

// Eliminar un producto
export async function deleteProduct(id: string): Promise<boolean> {
  if (db && !id.startsWith('local-') && !id.startsWith('prod-')) {
    try {
      const docRef = doc(db, 'products', id);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Error deleting in Firestore:', e);
    }
  }

  if (typeof window !== 'undefined') {
    const products = await fetchProducts();
    const updatedList = products.filter((p) => p.id !== id);
    localStorage.setItem('caceritos_products', JSON.stringify(updatedList));
  }

  return true;
}
