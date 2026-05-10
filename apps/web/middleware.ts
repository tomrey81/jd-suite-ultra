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

/**
 * Decode the JWT payload WITHOUT verifying the signature.
 * This is intentionally unverified — it is used only as a fast first-pass
 * check in Edge middleware (no Node crypto available). Route handlers MUST
 * still call auth() which performs the full HMAC verification.
 */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Session check: next-auth JWT cookie presence (not signature — Edge Runtime
  // limitation). Route handlers call auth() for full verification.
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

  // Admin route fast-check: decode JWT payload (unverified) and read
  // isPlatformAdmin claim. A missing or false claim redirects to /forbidden.
  // Route handlers still perform full auth() + DB verification.
  if (isAdminRoute(pathname)) {
    const payload = decodeJwtPayload(sessionCookie.value);
    const isAdmin = payload?.isPlatformAdmin === true;
    if (!isAdmin) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const url = req.nextUrl.clone();
      url.pathname = '/forbidden';
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp)$).*)'],
};
