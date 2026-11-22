import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  createSessionToken,
  verifySessionToken,
} from '@/lib/adminSession';

function parseFirebaseJwtEmail(idToken: string): string | null {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return null;
    const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as {
      email?: string;
      user_id?: string;
      sub?: string;
      exp?: number;
    };
    if (!payload || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.user_id && !payload.sub) return null;
    return payload.email || payload.user_id || payload.sub || null;
  } catch {
    return null;
  }
}

/** Crea una cookie de sesión firmada a partir de un ID Token válido de Firebase Auth. */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      token?: string;
      idToken?: string;
    };
    const rawToken = (body.token || body.idToken || '').trim();
    const email = parseFirebaseJwtEmail(rawToken);

    if (!email) {
      return NextResponse.json(
        { error: 'Se requiere un token de Firebase Auth válido.' },
        { status: 401 }
      );
    }

    const signedCookie = await createSessionToken(email);
    const response = NextResponse.json(
      { status: 'authenticated', user: { email } },
      { status: 200 }
    );
    response.cookies.set(SESSION_COOKIE_NAME, signedCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error: unknown) {
    console.error('Error al establecer sesión de Firebase:', error);
    return NextResponse.json(
      { error: 'Error al crear la sesión en el servidor.' },
      { status: 500 }
    );
  }
}

/** Devuelve el administrador autenticado (si la cookie firmada es válida). */
export async function GET(req: NextRequest) {
  const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 200 });
  }
  return NextResponse.json(
    { authenticated: true, user: { email: session.email } },
    { status: 200 }
  );
}

/** Cierra la sesión del administrador. */
export async function DELETE() {
  const response = NextResponse.json({ status: 'logged_out' }, { status: 200 });
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
