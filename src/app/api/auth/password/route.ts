import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  createSessionToken,
  getAdminPassword,
  hasCustomAdminPassword,
  safeCompare,
  setRuntimeAdminPassword,
  verifySessionToken,
} from '@/lib/adminSession';

export async function POST(req: NextRequest) {
  try {
    const session = await verifySessionToken(req.cookies.get(SESSION_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
    };

    const currentPassword = body.currentPassword || '';
    const newPassword = (body.newPassword || '').trim();

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Completa la contraseña actual y la nueva contraseña.' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'La nueva contraseña debe tener al menos 6 caracteres.' },
        { status: 400 }
      );
    }

    const activePassword = getAdminPassword();
    const currentOk = hasCustomAdminPassword()
      ? await safeCompare(currentPassword, activePassword)
      : (await safeCompare(currentPassword, 'admin1234')) ||
        (await safeCompare(currentPassword, '1234'));

    if (!currentOk) {
      return NextResponse.json(
        { error: 'La contraseña actual es incorrecta.' },
        { status: 401 }
      );
    }

    setRuntimeAdminPassword(newPassword);

    // Regenerar cookie firmada con la nueva clave activa
    const freshToken = await createSessionToken(session.email);
    const response = NextResponse.json({
      ok: true,
      message:
        'Contraseña actualizada. Para que quede fija tras futuros reinicios en Vercel, actualiza también ADMIN_PASSWORD en Vercel o conecta Firebase Auth.',
    });
    response.cookies.set(SESSION_COOKIE_NAME, freshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error: unknown) {
    console.error('Error cambiando contraseña:', error);
    return NextResponse.json(
      { error: 'No se pudo actualizar la contraseña.' },
      { status: 500 }
    );
  }
}
