import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { OrderRecord, OrderStatus } from '@/types';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

interface OrdersStoreData {
  orders: Record<string, OrderRecord>;
  deletedIds: Record<string, number>;
  updatedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __caseritosOrdersStore: OrdersStoreData | undefined;
}

const ORDERS_FILE_PATH = path.join(os.tmpdir(), 'caseritos_orders_store_v1.json');

const VALID_STATUSES: OrderStatus[] = ['pendiente', 'en_preparacion', 'entregado', 'cancelado'];

async function readOrdersStore(): Promise<OrdersStoreData> {
  try {
    const raw = await fs.readFile(ORDERS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as OrdersStoreData;
    if (parsed && typeof parsed.orders === 'object') {
      globalThis.__caseritosOrdersStore = {
        orders: parsed.orders || {},
        deletedIds: parsed.deletedIds || {},
        updatedAt: parsed.updatedAt || Date.now(),
      };
      return globalThis.__caseritosOrdersStore;
    }
  } catch {
    // Archivo todavía no creado en /tmp
  }

  if (!globalThis.__caseritosOrdersStore) {
    globalThis.__caseritosOrdersStore = {
      orders: {},
      deletedIds: {},
      updatedAt: Date.now(),
    };
  }
  return globalThis.__caseritosOrdersStore;
}

async function writeOrdersStore(store: OrdersStoreData): Promise<void> {
  store.updatedAt = Date.now();
  globalThis.__caseritosOrdersStore = store;
  try {
    await fs.writeFile(ORDERS_FILE_PATH, JSON.stringify(store), 'utf8');
  } catch {
    // Si el FS es de solo lectura, se mantiene en globalThis
  }
}

/** GET: Lista de pedidos para el administrador autenticado */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  const store = await readOrdersStore();
  const list = Object.values(store.orders).sort((a, b) => b.createdAt - a.createdAt);

  return NextResponse.json(
    { orders: list, updatedAt: store.updatedAt },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' },
    }
  );
}

/** POST: Registra un nuevo pedido (desde el Checkout del cliente o manual desde el Admin) */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { order?: OrderRecord };
    const order = body.order;

    if (
      !order ||
      !order.id ||
      !order.customerName?.trim() ||
      !Array.isArray(order.items) ||
      order.items.length === 0 ||
      typeof order.totalPrice !== 'number'
    ) {
      return NextResponse.json({ error: 'Datos de pedido inválidos.' }, { status: 400 });
    }

    const store = await readOrdersStore();
    const now = Date.now();

    // Solo un admin autenticado puede crear un pedido directamente en estado distinto a 'pendiente'
    let initialStatus: OrderStatus = 'pendiente';
    if (order.status && VALID_STATUSES.includes(order.status) && order.status !== 'pendiente') {
      const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
      if (session) {
        initialStatus = order.status;
      }
    }

    const saved: OrderRecord = {
      ...order,
      customerName: order.customerName.trim(),
      phoneNumber: (order.phoneNumber || '').trim(),
      status: initialStatus,
      createdAt: order.createdAt || now,
      updatedAt: now,
      completedAt: initialStatus === 'entregado' ? order.completedAt || now : undefined,
    };

    store.orders[saved.id] = saved;
    delete store.deletedIds[saved.id];
    await writeOrdersStore(store);

    return NextResponse.json({ ok: true, order: saved }, { status: 201 });
  } catch (error: unknown) {
    console.error('Error en POST /api/orders:', error);
    return NextResponse.json({ error: 'Error al registrar el pedido.' }, { status: 500 });
  }
}

/** PATCH: Actualiza el estado o los datos completos de un pedido (solo administrador) */
export async function PATCH(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      status?: OrderStatus;
      order?: OrderRecord;
    };

    const targetId = body.id || body.order?.id;
    const nextStatus = body.status || body.order?.status;

    if (!targetId || !nextStatus || !VALID_STATUSES.includes(nextStatus)) {
      return NextResponse.json({ error: 'Parámetros de actualización inválidos.' }, { status: 400 });
    }

    const store = await readOrdersStore();
    const existing = store.orders[targetId] || body.order;
    if (!existing) {
      return NextResponse.json({ error: 'Pedido no encontrado.' }, { status: 404 });
    }

    const now = Date.now();
    const merged: OrderRecord = {
      ...existing,
      ...(body.order || {}),
      id: targetId,
      status: nextStatus,
      updatedAt: now,
      completedAt:
        nextStatus === 'entregado'
          ? body.order?.completedAt || existing.completedAt || now
          : undefined,
    };

    store.orders[targetId] = merged;
    await writeOrdersStore(store);

    return NextResponse.json({ ok: true, order: merged }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error en PATCH /api/orders:', error);
    return NextResponse.json({ error: 'Error al actualizar el pedido.' }, { status: 500 });
  }
}

/** DELETE: Elimina un pedido (?id=...) o vacía todo el historial (?all=true) (solo administrador) */
export async function DELETE(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const clearAll = searchParams.get('all') === 'true';
    const id = searchParams.get('id');

    const store = await readOrdersStore();

    if (clearAll) {
      const now = Date.now();
      for (const existingId of Object.keys(store.orders)) {
        store.deletedIds[existingId] = now;
      }
      store.orders = {};
      await writeOrdersStore(store);
      return NextResponse.json({ ok: true, cleared: true }, { status: 200 });
    }

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID del pedido.' }, { status: 400 });
    }

    delete store.orders[id];
    store.deletedIds[id] = Date.now();
    await writeOrdersStore(store);

    return NextResponse.json({ ok: true, id }, { status: 200 });
  } catch (error: unknown) {
    console.error('Error en DELETE /api/orders:', error);
    return NextResponse.json({ error: 'Error al eliminar el pedido.' }, { status: 500 });
  }
}
