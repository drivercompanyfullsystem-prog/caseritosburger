import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { Product } from '@/types';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/adminSession';

export const dynamic = 'force-dynamic';

export interface ServerProductOverride extends Partial<Product> {
  id: string;
  deleted?: boolean;
  updatedAt?: number;
  createdAt?: number;
}

interface ServerStoreData {
  overrides: Record<string, ServerProductOverride>;
  whatsappPhone?: string;
  updatedAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __caseritosServerStore: ServerStoreData | undefined;
}

const STORE_FILE_PATH = path.join(os.tmpdir(), 'caseritos_server_store_v1.json');

async function readServerStore(): Promise<ServerStoreData> {
  try {
    const raw = await fs.readFile(STORE_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as ServerStoreData;
    if (parsed && typeof parsed.overrides === 'object') {
      globalThis.__caseritosServerStore = parsed;
      return parsed;
    }
  } catch {
    // Si no existe el archivo en /tmp todavía, usar memoria global
  }

  if (!globalThis.__caseritosServerStore) {
    globalThis.__caseritosServerStore = {
      overrides: {},
      updatedAt: Date.now(),
    };
  }
  return globalThis.__caseritosServerStore;
}

async function writeServerStore(store: ServerStoreData): Promise<void> {
  store.updatedAt = Date.now();
  globalThis.__caseritosServerStore = store;
  try {
    await fs.writeFile(STORE_FILE_PATH, JSON.stringify(store), 'utf8');
  } catch {
    // En caso de solo lectura, se mantiene en globalThis.__caseritosServerStore
  }
}

export async function GET() {
  const store = await readServerStore();
  return NextResponse.json(
    {
      overrides: Object.values(store.overrides),
      whatsappPhone: store.whatsappPhone || null,
      updatedAt: store.updatedAt,
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    // Verificar cookie de administrador
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      override?: ServerProductOverride;
      whatsappPhone?: string;
    };

    const store = await readServerStore();

    if (body.override && body.override.id) {
      const id = body.override.id;
      store.overrides[id] = {
        ...(store.overrides[id] || {}),
        ...body.override,
        id,
        updatedAt: Date.now(),
      };
    }

    if (typeof body.whatsappPhone === 'string' && body.whatsappPhone.trim()) {
      store.whatsappPhone = body.whatsappPhone.trim();
    }

    await writeServerStore(store);

    return NextResponse.json({
      ok: true,
      overrides: Object.values(store.overrides),
      whatsappPhone: store.whatsappPhone || null,
      updatedAt: store.updatedAt,
    });
  } catch (error: unknown) {
    console.error('Error en /api/products POST:', error);
    return NextResponse.json({ error: 'Error al guardar cambios.' }, { status: 500 });
  }
}
