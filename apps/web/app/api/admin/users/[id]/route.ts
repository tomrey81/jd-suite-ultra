import { NextRequest, NextResponse } from 'next/server';
import { hash as bcryptHash } from 'bcryptjs';
import { db } from '@jd-suite/db';
import { requireAdminApi, requireAdminApiThrottled, isAdminResponse } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { sanitizeText } from '@/lib/admin/sanitize';

export const dynamic = 'force-dynamic';

// DELETE /api/admin/users/[id] — soft "deactivate" by clearing passwordHash
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApiThrottled();
  if (isAdminResponse(admin)) return admin;
  const { id } = await params;
  if (id === admin.id) return NextResponse.json({ error: 'Cannot deactivate yourself' }, { status: 400 });

  await db.user.update({ where: { id }, data: { passwordHash: null } });
  await logAdminAction(admin.id, 'user_deactivated', { userId: id });
  return NextResponse.json({ ok: true });
}

// POST /api/admin/users/[id] — admin password reset (sets new hash directly)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApiThrottled();
  if (isAdminResponse(admin)) return admin;
  const { id } = await params;

  const body = await req.json().catch(() => null) as { action?: string; newPassword?: string } | null;
  if (!body || body.action !== 'reset_password') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
  const pw = sanitizeText(body.newPassword, 128);
  if (!pw || pw.length < 12) {
    return NextResponse.json({ error: 'Password must be at least 12 characters' }, { status: 400 });
  }
  const passwordHash = await bcryptHash(pw, 12);
  await db.user.update({ where: { id }, data: { passwordHash } });
  await logAdminAction(admin.id, 'user_password_reset', { userId: id });
  return NextResponse.json({ ok: true });
}
