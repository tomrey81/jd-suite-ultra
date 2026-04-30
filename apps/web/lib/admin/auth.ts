import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { checkRateLimit } from './rate-limit';

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
};

/**
 * Server Component / Layout guard.
 * Redirects to /login if not signed in, /admin/forbidden if not platform admin.
 */
export async function requireAdmin(): Promise<AdminUser> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/admin');
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, isPlatformAdmin: true },
  });
  if (!user || !user.isPlatformAdmin) {
    redirect('/forbidden');
  }
  return { id: user.id, email: user.email, name: user.name };
}

/**
 * API route guard. Returns the admin user or a NextResponse to short-circuit.
 * Always check the return type with a type guard before continuing.
 */
export async function requireAdminApi(): Promise<AdminUser | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, isPlatformAdmin: true },
  });
  if (!user || !user.isPlatformAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { id: user.id, email: user.email, name: user.name };
}

export function isAdminResponse(x: AdminUser | NextResponse): x is NextResponse {
  return x instanceof NextResponse;
}

/**
 * Combined: admin auth + rate limit. Use on write endpoints.
 * 60 admin writes per minute per actor — high enough to never bother a
 * legitimate admin, low enough to slow runaway scripts.
 */
export async function requireAdminApiThrottled(
  bucket = 'admin',
  max = 60,
  windowMs = 60_000,
): Promise<AdminUser | NextResponse> {
  const admin = await requireAdminApi();
  if (isAdminResponse(admin)) return admin;

  let ip = 'unknown';
  try {
    const h = await headers();
    ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
  } catch {
    // not in request scope
  }
  const rl = await checkRateLimit(`${bucket}:${admin.id}:${ip}`, max, windowMs);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Slow down.' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }
  return admin;
}
