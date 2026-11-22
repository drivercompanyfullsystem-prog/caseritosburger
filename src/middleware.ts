import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/adminSession';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const isAuthenticated = Boolean(session);

  const isLoginRoute = pathname === '/admin/login';

  // Si visita /admin/login y ya está autenticado -> redirigir al dashboard
  if (isLoginRoute) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protección para endpoints API de administración (/api/admin/*)
  if (pathname.startsWith('/api/admin')) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: 'No autorizado. Inicia sesión como administrador.' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // Cualquier otra ruta bajo /admin/*
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      // Limpia cookies viejas o inválidas
      if (request.cookies.get(SESSION_COOKIE_NAME)) {
        response.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 });
      }
      return response;
    }

    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
