import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/welcome', '/login', '/register', '/forgot-password', '/reset-password',
  '/forbidden', '/legal/terms', '/legal/privacy',
  // Sonification receiver — cross-device entry point, must work without auth
  // since the listening device may be a phone that's not signed in.
  '/sonification/receiver',
]);

const PUBLIC_PREFIXES = [
  '/api/auth',           // next-auth handlers + register endpoint
  '/api/guest',          // guest review token endpoints
  '/_next',
  '/favicon',
];

const ADMIN_PREFIXES = ['/admin', '/api/admin'];

function isPublic(path: string) {
  if (PUBLIC_PATHS.has(path)) return true;
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

function isAdminRoute(path: string) {
  return ADMIN_PREFIXES.some((p) => path.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Session check: next-auth JWT cookie presence. NextAuth issues encrypted
  // JWE tokens (5 parts) that cannot be decoded in Edge middleware without
  // the secret. Authentication and admin checks are delegated to server-side
  // auth() calls in layouts and route handlers.
  const sessionCookie =
    req.cookies.get('next-auth.session-token') ||
    req.cookies.get('__Secure-next-auth.session-token') ||
    req.cookies.get('authjs.session-token') ||
    req.cookies.get('__Secure-authjs.session-token');

  if (!sessionCookie) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (pathname === '/') {
      const url = req.nextUrl.clone();
      url.pathname = '/welcome';
      return NextResponse.redirect(url);
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Admin routes: session cookie presence is confirmed above. The admin
  // layout calls requireAdmin() which performs full auth() + DB verification
  // of the isPlatformAdmin flag. No fast-check needed here.

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp)$).*)'],
};
