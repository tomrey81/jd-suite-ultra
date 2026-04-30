import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { requireAdminApi, requireAdminApiThrottled, isAdminResponse } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { sanitizeText } from '@/lib/admin/sanitize';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const admin = await requireAdminApi();
  if (isAdminResponse(admin)) return admin;

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const q = (url.searchParams.get('q') || '').trim();

  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: 'insensitive' as const } },
          { name: { contains: q, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true, email: true, name: true, firstName: true, lastName: true,
        country: true, jobFunction: true, isPlatformAdmin: true,
        marketingOptIn: true, lastLoginAt: true, createdAt: true,
        memberships: { select: { role: true, org: { select: { id: true, name: true } } } },
      },
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({ users, total, limit, offset });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminApiThrottled();
  if (isAdminResponse(admin)) return admin;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
  const id = body.id;

  const updates: Record<string, unknown> = {};
  if (typeof body.isPlatformAdmin === 'boolean') updates.isPlatformAdmin = body.isPlatformAdmin;
  if (typeof body.firstName === 'string') updates.firstName = sanitizeText(body.firstName, 100);
  if (typeof body.lastName === 'string') updates.lastName = sanitizeText(body.lastName, 100);
  if (typeof body.country === 'string') updates.country = sanitizeText(body.country, 56);
  if (typeof body.jobFunction === 'string') updates.jobFunction = sanitizeText(body.jobFunction, 120);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Guardrail: don't let admin demote themselves to non-admin (safety net)
  if (updates.isPlatformAdmin === false && id === admin.id) {
    return NextResponse.json({ error: 'You cannot remove your own admin role' }, { status: 400 });
  }

  const updated = await db.user.update({ where: { id }, data: updates });
  await logAdminAction(admin.id, 'user_updated', { userId: id, fields: Object.keys(updates) });
  return NextResponse.json({ ok: true, user: { id: updated.id, isPlatformAdmin: updated.isPlatformAdmin } });
}
