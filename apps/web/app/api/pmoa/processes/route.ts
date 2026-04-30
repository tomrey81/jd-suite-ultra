import { NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';

export const dynamic = 'force-dynamic';

export async function GET() {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const processes = await db.pmoaProcess.findMany({
    where: { orgId: scope.orgId },
    orderBy: { name: 'asc' },
  });
  // Compute step count per process via a single grouped query
  const counts = await db.pmoaProcessStep.groupBy({
    by: ['processId'],
    where: { processId: { in: processes.map((p) => p.id) } },
    _count: { _all: true },
  });
  const countByProcess = new Map(counts.map((c) => [c.processId, c._count._all]));

  return NextResponse.json({
    processes: processes.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      ownerPositionId: p.ownerPositionId,
      validityFlag: p.validityFlag,
      sourceDocumentIds: p.sourceDocumentIds,
      stepCount: countByProcess.get(p.id) || 0,
      updatedAt: p.updatedAt,
    })),
  });
}
