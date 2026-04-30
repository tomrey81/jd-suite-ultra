import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { requireAdminApi, requireAdminApiThrottled, isAdminResponse } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';
import { sanitizeText } from '@/lib/admin/sanitize';

export const dynamic = 'force-dynamic';

export async function GET() {
  const admin = await requireAdminApi();
  if (isAdminResponse(admin)) return admin;
  const orgs = await db.organisation.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { memberships: true, jobDescriptions: true } },
    },
  });
  return NextResponse.json({ orgs });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdminApiThrottled();
  if (isAdminResponse(admin)) return admin;
  const body = await req.json().catch(() => null) as { id?: string; name?: string } | null;
  if (!body?.id || !body.name) {
    return NextResponse.json({ error: 'id and name required' }, { status: 400 });
  }
  const name = sanitizeText(body.name, 200);
  if (!name) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  await db.organisation.update({ where: { id: body.id }, data: { name } });
  await logAdminAction(admin.id, 'org_renamed', { orgId: body.id, name });
  return NextResponse.json({ ok: true });
}
