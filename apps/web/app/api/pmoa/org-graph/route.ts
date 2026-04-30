import { NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';

export const dynamic = 'force-dynamic';

export async function GET() {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const [positions, departments, assignments] = await Promise.all([
    db.pmoaPosition.findMany({
      where: { orgId: scope.orgId },
      orderBy: { name: 'asc' },
    }),
    db.pmoaDepartment.findMany({ where: { orgId: scope.orgId } }),
    db.pmoaAssignment.findMany({ where: { orgId: scope.orgId } }),
  ]);

  return NextResponse.json({
    positions: positions.map((p) => ({
      id: p.id,
      name: p.name,
      positionNumber: p.positionNumber,
      reportsToId: p.reportsToId,
      departmentId: p.departmentId,
      currentHolderName: p.currentHolderName,
      vacancy: p.vacancy,
      spanOfControl: p.spanOfControl,
      linkedJdId: p.linkedJdId,
      sourceDocumentIds: p.sourceDocumentIds,
    })),
    departments: departments.map((d) => ({
      id: d.id,
      name: d.name,
      parentId: d.parentId,
      headPositionId: d.headPositionId,
    })),
    assignments: assignments.map((a) => ({
      id: a.id,
      positionId: a.positionId,
      personName: a.personName,
      kind: a.kind,
      splitAllocations: a.splitAllocations,
    })),
  });
}
