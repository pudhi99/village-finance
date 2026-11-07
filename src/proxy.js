/**
 * Next.js 16 proxy — refreshes Supabase auth session on every request.
 * Protected routes redirect unauthenticated users to /login.
 */
import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // Static PWA & public asset paths that must never be redirected to /login
  if (
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname.startsWith('/icon-') ||
    pathname === '/apple-touch-icon.png' ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.ico')
  ) {
    return NextResponse.next();
  }

  const { supabaseResponse, user } = await updateSession(request);

  // Public routes that don't require authentication
  const publicPaths = ['/login', '/auth/callback', '/auth/confirm'];
  const isPublic = publicPaths.some((p) => pathname.startsWith(p));

  if (!isPublic && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (static assets)
     * - favicon.ico, manifest.json, sw.js
     * - static files (.png, .svg, .ico, .jpg, .json)
     * - api/health (public health check)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icon-.*|apple-touch-icon.png|api/health|.*\\.(?:png|jpg|jpeg|svg|webp|ico|json)$).*)',
  ],
};
