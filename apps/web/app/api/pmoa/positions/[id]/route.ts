import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';

export const dynamic = 'force-dynamic';

const PatchBody = z.object({
  name: z.string().min(1).max(300).optional(),
  positionNumber: z.string().max(50).nullish(),
  departmentId: z.string().uuid().nullish(),
  reportsToId: z.string().uuid().nullish(),
  currentHolderName: z.string().max(200).nullish(),
  vacancy: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const existing = await db.pmoaPosition.findFirst({ where: { id, orgId: scope.orgId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const { name, positionNumber, departmentId, reportsToId, currentHolderName, vacancy } = parsed.data;

  // Verify referenced records belong to this org
  if (departmentId) {
    const dept = await db.pmoaDepartment.findFirst({ where: { id: departmentId, orgId: scope.orgId } });
    if (!dept) return NextResponse.json({ error: 'Department not found' }, { status: 404 });
  }
  if (reportsToId) {
    // Prevent circular reference
    if (reportsToId === id) {
      return NextResponse.json({ error: 'Position cannot report to itself' }, { status: 400 });
    }
    const parent = await db.pmoaPosition.findFirst({ where: { id: reportsToId, orgId: scope.orgId } });
    if (!parent) return NextResponse.json({ error: 'Reports-to position not found' }, { status: 404 });
  }

  const position = await db.pmoaPosition.update({
    where: { id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...('positionNumber' in parsed.data && { positionNumber: positionNumber?.trim() || null }),
      ...('departmentId' in parsed.data && { departmentId: departmentId || null }),
      ...('reportsToId' in parsed.data && { reportsToId: reportsToId || null }),
      ...('currentHolderName' in parsed.data && { currentHolderName: currentHolderName?.trim() || null }),
      ...(vacancy !== undefined && { vacancy }),
    },
  });

  return NextResponse.json({ ok: true, position });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const existing = await db.pmoaPosition.findFirst({ where: { id, orgId: scope.orgId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Unlink children that reported to this position
  await db.pmoaPosition.updateMany({
    where: { reportsToId: id, orgId: scope.orgId },
    data: { reportsToId: null },
  });

  // Delete assignments for this position
  await db.pmoaAssignment.deleteMany({ where: { positionId: id } });

  // Unlink dept heads
  await db.pmoaDepartment.updateMany({
    where: { headPositionId: id, orgId: scope.orgId },
    data: { headPositionId: null },
  });

  await db.pmoaPosition.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
