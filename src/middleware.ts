import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('__session')?.value;
  const isAuthenticated = Boolean(sessionCookie && sessionCookie.trim().length > 0);

  const isLoginRoute = pathname === '/admin/login';

  // Si el usuario visita /admin/login y ya está autenticado -> redirigir a /admin/dashboard
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

  // Para cualquier otra ruta bajo /admin/*
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Si visita exactamente /admin estando autenticado, redirigir a /admin/dashboard
    if (pathname === '/admin') {
      return NextResponse.redirect(new URL('/admin/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/admin/:path*', '/api/admin/:path*'],
};
