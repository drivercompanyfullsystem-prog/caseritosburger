import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { CustomerOrder, OrderRecord, OrderStatus } from '../types';

const LOCAL_ORDERS_KEY = 'caceritos_orders_v1';

function cleanUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) {
      out[key] = obj[key];
    }
  }
  return out;
}

function readLocalOrders(): OrderRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OrderRecord[]) : [];
  } catch {
    return [];
  }
}

function saveLocalOrders(orders: OrderRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
  } catch {
    // ignorar si localStorage está lleno
  }
}

function mergeOrders(...lists: OrderRecord[][]): OrderRecord[] {
  const byId = new Map<string, OrderRecord>();
  for (const list of lists) {
    for (const order of list) {
      if (!order || !order.id) continue;
      const prev = byId.get(order.id);
      if (!prev || (order.updatedAt || 0) >= (prev.updatedAt || 0)) {
        byId.set(order.id, order);
      }
    }
  }
  return Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
}

function generateOrderNumber(): string {
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `#CB-${suffix}`;
}

/** Construye y guarda un pedido cuando el cliente confirma en CheckoutModal */
export async function recordCustomerOrder(order: CustomerOrder): Promise<OrderRecord> {
  const now = Date.now();
  const id = `ord-${now}-${Math.random().toString(36).slice(2, 6)}`;

  const record: OrderRecord = {
    id,
    orderNumber: generateOrderNumber(),
    customerName: order.customerName.trim(),
    phoneNumber: order.phoneNumber.trim(),
    deliveryMethod: order.deliveryMethod,
    address: order.address?.trim() || undefined,
    references: order.references?.trim() || undefined,
    paymentMethod: order.paymentMethod,
    cashAmount: order.cashAmount?.trim() || undefined,
    notes: order.notes?.trim() || undefined,
    items: order.items.map((item) => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      unitPrice: item.product.price,
      subtotal: item.quantity * item.product.price,
      instructions: item.instructions?.trim() || undefined,
    })),
    totalPrice: order.totalPrice,
    status: 'pendiente',
    createdAt: now,
    updatedAt: now,
  };

  // 1. Guardar inmediatamente en local cache
  const local = readLocalOrders();
  saveLocalOrders(mergeOrders([record], local));

  // 2. Guardar en servidor (/api/orders)
  if (typeof window !== 'undefined') {
    fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: record }),
      keepalive: true,
    }).catch(() => {});
  }

  // 3. Guardar en Firestore si está configurado
  if (db) {
    try {
      await setDoc(doc(db, 'orders', id), cleanUndefined(record as unknown as Record<string, unknown>));
    } catch (e) {
      console.warn('No se pudo guardar el pedido en Firestore:', e);
    }
  }

  return record;
}

/** Crea un pedido manual desde el panel Admin (ej. venta en mostrador o por mensaje directo) */
export async function createManualOrder(input: {
  customerName: string;
  phoneNumber?: string;
  deliveryMethod: 'delivery' | 'pickup';
  paymentMethod: 'Efectivo' | 'Transferencia' | 'POS';
  items: OrderRecord['items'];
  notes?: string;
  status: OrderStatus;
}): Promise<OrderRecord> {
  const now = Date.now();
  const id = `ord-${now}-${Math.random().toString(36).slice(2, 6)}`;
  const totalPrice = input.items.reduce((sum, i) => sum + i.subtotal, 0);

  const record: OrderRecord = {
    id,
    orderNumber: generateOrderNumber(),
    customerName: input.customerName.trim(),
    phoneNumber: (input.phoneNumber || '').trim(),
    deliveryMethod: input.deliveryMethod,
    paymentMethod: input.paymentMethod,
    notes: input.notes?.trim() || undefined,
    items: input.items,
    totalPrice,
    status: input.status,
    createdAt: now,
    updatedAt: now,
    completedAt: input.status === 'entregado' ? now : undefined,
  };

  const local = readLocalOrders();
  saveLocalOrders(mergeOrders([record], local));

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: record }),
      });
    } catch {
      // ignorar
    }
  }

  if (db) {
    try {
      await setDoc(doc(db, 'orders', id), cleanUndefined(record as unknown as Record<string, unknown>));
    } catch (e) {
      console.warn('Error guardando pedido manual en Firestore:', e);
    }
  }

  return record;
}

async function fetchServerOrders(): Promise<OrderRecord[]> {
  if (typeof window === 'undefined') return [];
  try {
    const res = await fetch('/api/orders', { cache: 'no-store' });
    if (!res.ok) return [];
    const data = (await res.json()) as { orders?: OrderRecord[] };
    return Array.isArray(data.orders) ? data.orders : [];
  } catch {
    return [];
  }
}

export async function fetchOrders(): Promise<OrderRecord[]> {
  const firestoreOrders: OrderRecord[] = [];

  if (db) {
    try {
      const snap = await getDocs(query(collection(db, 'orders')));
      for (const docSnap of snap.docs) {
        firestoreOrders.push({
          ...(docSnap.data() as OrderRecord),
          id: docSnap.id,
        });
      }
    } catch (e) {
      console.warn('No se pudieron leer pedidos desde Firestore:', e);
    }
  }

  const serverOrders = await fetchServerOrders();
  const localOrders = readLocalOrders();
  const merged = mergeOrders(firestoreOrders, serverOrders, localOrders);
  saveLocalOrders(merged);
  return merged;
}

/** Suscripción en tiempo real a pedidos (Firestore + servidor + revalidación al volver al foco) */
export function subscribeToOrders(onUpdate: (orders: OrderRecord[]) => void): () => void {
  let isActive = true;

  const refreshAll = async () => {
    const list = await fetchOrders();
    if (isActive) onUpdate(list);
  };

  refreshAll();

  const handleVisibility = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      refreshAll();
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('focus', refreshAll);
    document.addEventListener('visibilitychange', handleVisibility);
  }

  let unsubFirestore: (() => void) | null = null;
  if (db) {
    unsubFirestore = onSnapshot(
      query(collection(db, 'orders')),
      async (snapshot) => {
        const fsOrders = snapshot.docs.map((docSnap) => ({
          ...(docSnap.data() as OrderRecord),
          id: docSnap.id,
        }));
        const serverOrders = await fetchServerOrders();
        const merged = mergeOrders(fsOrders, serverOrders, readLocalOrders());
        saveLocalOrders(merged);
        if (isActive) onUpdate(merged);
      },
      () => {
        refreshAll();
      }
    );
  }

  return () => {
    isActive = false;
    if (unsubFirestore) unsubFirestore();
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', refreshAll);
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  };
}

export async function updateOrderStatus(
  order: OrderRecord,
  newStatus: OrderStatus
): Promise<OrderRecord> {
  const now = Date.now();
  const updated: OrderRecord = {
    ...order,
    status: newStatus,
    updatedAt: now,
    completedAt: newStatus === 'entregado' ? order.completedAt || now : undefined,
  };

  const local = readLocalOrders();
  const nextLocal = mergeOrders([updated], local);
  saveLocalOrders(nextLocal);

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: order.id, status: newStatus, order: updated }),
      });
    } catch {
      // ignorar
    }
  }

  if (db) {
    try {
      await setDoc(
        doc(db, 'orders', order.id),
        cleanUndefined(updated as unknown as Record<string, unknown>),
        { merge: true }
      );
    } catch (e) {
      console.warn('No se pudo actualizar el estado del pedido en Firestore:', e);
    }
  }

  return updated;
}

export async function updateOrderRecord(order: OrderRecord): Promise<OrderRecord> {
  const now = Date.now();
  const recalculatedTotal = order.items.reduce((sum, i) => sum + i.subtotal, 0);
  const updated: OrderRecord = {
    ...order,
    customerName: order.customerName.trim(),
    phoneNumber: (order.phoneNumber || '').trim(),
    address: order.address?.trim() || undefined,
    references: order.references?.trim() || undefined,
    notes: order.notes?.trim() || undefined,
    totalPrice: recalculatedTotal,
    updatedAt: now,
    completedAt:
      order.status === 'entregado' ? order.completedAt || now : undefined,
  };

  const local = readLocalOrders();
  saveLocalOrders(mergeOrders([updated], local));

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: updated.id, status: updated.status, order: updated }),
      });
    } catch {
      // ignorar
    }
  }

  if (db) {
    try {
      await setDoc(
        doc(db, 'orders', updated.id),
        cleanUndefined(updated as unknown as Record<string, unknown>),
        { merge: true }
      );
    } catch (e) {
      console.warn('No se pudo actualizar el pedido en Firestore:', e);
    }
  }

  return updated;
}

export async function deleteOrderRecord(id: string): Promise<void> {
  const filtered = readLocalOrders().filter((o) => o.id !== id);
  saveLocalOrders(filtered);

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/orders?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch {
      // ignorar
    }
  }

  if (db) {
    try {
      await deleteDoc(doc(db, 'orders', id));
    } catch (e) {
      console.warn('No se pudo eliminar el pedido en Firestore:', e);
    }
  }
}

export async function clearAllOrders(existingIds: string[]): Promise<void> {
  saveLocalOrders([]);

  if (typeof window !== 'undefined') {
    try {
      await fetch('/api/orders?all=true', { method: 'DELETE' });
    } catch {
      // ignorar
    }
  }

  if (db && existingIds.length > 0) {
    await Promise.all(
      existingIds.map((id) =>
        deleteDoc(doc(db!, 'orders', id)).catch((e) => {
          console.warn('No se pudo eliminar pedido en Firestore:', id, e);
        })
      )
    );
  }
}
