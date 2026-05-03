import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';

export const dynamic = 'force-dynamic';

const PatchBody = z.object({
  name: z.string().min(1).max(300).optional(),
  parentId: z.string().uuid().nullish(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const existing = await db.pmoaDepartment.findFirst({ where: { id: params.id, orgId: scope.orgId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const { name, parentId } = parsed.data;

  if (parentId && parentId === params.id) {
    return NextResponse.json({ error: 'Department cannot be its own parent' }, { status: 400 });
  }

  const department = await db.pmoaDepartment.update({
    where: { id: params.id },
    data: {
      ...(name !== undefined && { name: name.trim() }),
      ...('parentId' in parsed.data && { parentId: parentId || null }),
    },
  });

  return NextResponse.json({ ok: true, department });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const existing = await db.pmoaDepartment.findFirst({ where: { id: params.id, orgId: scope.orgId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Move child departments to parent
  await db.pmoaDepartment.updateMany({
    where: { parentId: params.id, orgId: scope.orgId },
    data: { parentId: existing.parentId },
  });

  // Unlink positions that belong to this dept
  await db.pmoaPosition.updateMany({
    where: { departmentId: params.id, orgId: scope.orgId },
    data: { departmentId: null },
  });

  await db.pmoaDepartment.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
