import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = '__session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 5; // 5 días en segundos

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token: string | undefined = body.token || body.idToken;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Se requiere un token de autenticación válido.' },
        { status: 400 }
      );
    }

    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return NextResponse.json({ status: 'authenticated' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error al crear la sesión.', details: error?.message },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const cookieStore = cookies();
    cookieStore.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return NextResponse.json({ status: 'logged_out' }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Error al cerrar la sesión.', details: error?.message },
      { status: 500 }
    );
  }
}
