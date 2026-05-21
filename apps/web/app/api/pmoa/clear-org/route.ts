import { NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';

export const dynamic = 'force-dynamic';

export async function DELETE() {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  await db.$transaction(async (tx) => {
    await tx.pmoaAssignment.deleteMany({ where: { orgId: scope.orgId } });
    await tx.pmoaPosition.deleteMany({ where: { orgId: scope.orgId } });
    await tx.pmoaDepartment.deleteMany({ where: { orgId: scope.orgId } });
  });

  return NextResponse.json({ ok: true });
}
