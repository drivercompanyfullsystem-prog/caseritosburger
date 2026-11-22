import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  createSessionToken,
  getAdminEmail,
  getAdminPassword,
  hasCustomAdminPassword,
  safeCompare,
} from '@/lib/adminSession';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';

    const adminPassword = getAdminPassword();
    if (!adminPassword) {
      return NextResponse.json(
        {
          error:
            'El acceso de administrador aún no está configurado. Agrega la variable ADMIN_PASSWORD en Vercel y vuelve a desplegar.',
        },
        { status: 503 }
      );
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Ingresa tu correo y contraseña.' }, { status: 400 });
    }

    const adminEmail = getAdminEmail();
    const emailOk = adminEmail
      ? await safeCompare(email, adminEmail)
      : /^\S+@\S+\.\S+$/.test(email);
    const passwordOk = hasCustomAdminPassword()
      ? await safeCompare(password, adminPassword)
      : (await safeCompare(password, 'admin1234')) || (await safeCompare(password, '1234'));

    if (!emailOk || !passwordOk) {
      // Pequeña demora para frenar intentos de adivinar la clave
      await wait(700);
      return NextResponse.json({ error: 'Correo o contraseña incorrectos.' }, { status: 401 });
    }

    const token = await createSessionToken(email);
    const response = NextResponse.json({ status: 'authenticated', user: { email } });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error: unknown) {
    console.error('Error en login de administrador:', error);
    return NextResponse.json(
      { error: 'No se pudo iniciar sesión. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}
