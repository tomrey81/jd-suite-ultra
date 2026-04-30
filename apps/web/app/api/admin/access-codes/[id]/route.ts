import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { requireAdminApi, requireAdminApiThrottled, isAdminResponse } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';

export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApiThrottled();
  if (isAdminResponse(admin)) return admin;
  const { id } = await params;
  const body = await req.json().catch(() => null) as { active?: boolean } | null;
  if (!body || typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'active boolean required' }, { status: 400 });
  }
  await db.accessCode.update({ where: { id }, data: { active: body.active } });
  await logAdminAction(admin.id, body.active ? 'access_code_activated' : 'access_code_deactivated', { id });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApiThrottled();
  if (isAdminResponse(admin)) return admin;
  const { id } = await params;
  // Cascading delete will remove uses too.
  await db.accessCode.delete({ where: { id } });
  await logAdminAction(admin.id, 'access_code_deleted', { id });
  return NextResponse.json({ ok: true });
}
