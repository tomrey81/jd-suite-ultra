import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';
import { buildProcessesFromCorpus } from '@/lib/pmoa/builders';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const docs = await db.pmoaDocument.findMany({
    where: {
      orgId: scope.orgId,
      parseStatus: 'done',
      validityFlag: { in: ['recent', 'partially_valid'] },
    },
    select: { id: true, name: true, rawText: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });

  if (docs.length === 0) {
    return NextResponse.json({
      error: 'No usable documents. Upload SOPs / regulations / process maps first, then tag them.',
    }, { status: 400 });
  }

  let result;
  try {
    result = await buildProcessesFromCorpus(docs.map((d) => ({ id: d.id, name: d.name, rawText: d.rawText || '' })));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'AI extraction failed' }, { status: 502 });
  }

  // Position lookup for actor resolution
  const positions = await db.pmoaPosition.findMany({
    where: { orgId: scope.orgId },
    select: { id: true, name: true },
  });
  const posByLowerName = new Map(positions.map((p) => [p.name.toLowerCase(), p.id]));

  const created = await db.$transaction(async (tx) => {
    // Wipe and replace — same posture as build-org
    await tx.pmoaProcess.deleteMany({ where: { orgId: scope.orgId } });

    let stepCount = 0;
    for (const proc of result.processes) {
      const procId = randomUUID();
      const ownerPositionId = proc.ownerRoleName
        ? posByLowerName.get(proc.ownerRoleName.toLowerCase()) ?? null
        : null;
      await tx.pmoaProcess.create({
        data: {
          id: procId,
          orgId: scope.orgId,
          name: proc.name,
          description: proc.description,
          ownerPositionId,
          validityFlag: 'recent',
          sourceDocumentIds: proc.sourceDocumentIds || [],
        },
      });
      for (const s of proc.steps) {
        const actorPositionId = s.actorRoleName
          ? posByLowerName.get(s.actorRoleName.toLowerCase()) ?? null
          : null;
        await tx.pmoaProcessStep.create({
          data: {
            id: randomUUID(),
            processId: procId,
            stepOrder: s.stepOrder,
            name: s.name,
            kind: s.kind,
            actorPositionId,
            actorRoleName: s.actorRoleName,
            slaDescription: s.slaDescription,
            sourceDocumentId: s.sourceDocumentId,
            sourcePage: s.sourcePage,
          },
        });
        stepCount++;
      }
    }
    return { processes: result.processes.length, steps: stepCount };
  });

  return NextResponse.json({
    ok: true,
    created,
    globalClarifications: result.globalClarifications,
  });
}
