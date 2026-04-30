import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { requireAdminApi, requireAdminApiThrottled, isAdminResponse } from '@/lib/admin/auth';
import { logAdminAction } from '@/lib/admin/audit';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminApiThrottled();
  if (isAdminResponse(admin)) return admin;
  const { id } = await params;
  // Cascading deletes are wired in the schema (Membership, JD, Template etc.)
  // Force a confirmation by counting first.
  const counts = await db.organisation.findUnique({
    where: { id },
    include: { _count: { select: { memberships: true, jobDescriptions: true } } },
  });
  if (!counts) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.organisation.delete({ where: { id } });
  await logAdminAction(admin.id, 'org_deleted', {
    orgId: id, name: counts.name,
    membersDeleted: counts._count.memberships,
    jdsDeleted: counts._count.jobDescriptions,
  });
  return NextResponse.json({ ok: true });
}
