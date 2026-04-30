import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { randomUUID } from 'node:crypto';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;
  const { id } = await params;

  const proc = await db.pmoaProcess.findFirst({
    where: { id, orgId: scope.orgId },
  });
  if (!proc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const steps = await db.pmoaProcessStep.findMany({
    where: { processId: id },
    orderBy: { stepOrder: 'asc' },
  });

  const positions = await db.pmoaPosition.findMany({
    where: { orgId: scope.orgId },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    process: {
      id: proc.id,
      name: proc.name,
      description: proc.description,
      ownerPositionId: proc.ownerPositionId,
      validityFlag: proc.validityFlag,
      sourceDocumentIds: proc.sourceDocumentIds,
    },
    steps: steps.map((s) => ({
      id: s.id,
      stepOrder: s.stepOrder,
      name: s.name,
      kind: s.kind,
      actorPositionId: s.actorPositionId,
      actorRoleName: s.actorRoleName,
      slaDescription: s.slaDescription,
      sourceDocumentId: s.sourceDocumentId,
      sourcePage: s.sourcePage,
      outgoing: s.outgoing ?? [],
    })),
    positions,
  });
}

interface PatchBody {
  name?: string;
  description?: string;
  steps?: Array<{
    id?: string;                         // omit/undefined = create new
    stepOrder: number;
    name: string;
    kind: 'task' | 'decision' | 'handoff' | 'event' | 'start' | 'end' | 'timer';
    actorPositionId?: string | null;
    actorRoleName?: string | null;
    slaDescription?: string | null;
    outgoing?: Array<{ targetStepId: string; label?: string }>;
  }>;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const proc = await db.pmoaProcess.findFirst({ where: { id, orgId: scope.orgId } });
  if (!proc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.$transaction(async (tx) => {
    if (typeof body.name === 'string' || typeof body.description === 'string') {
      await tx.pmoaProcess.update({
        where: { id },
        data: {
          ...(typeof body.name === 'string' ? { name: body.name } : {}),
          ...(typeof body.description === 'string' ? { description: body.description } : {}),
          updatedAt: new Date(),
        },
      });
    }
    if (Array.isArray(body.steps)) {
      // Replace steps wholesale — simpler than diffing for v1
      await tx.pmoaProcessStep.deleteMany({ where: { processId: id } });
      for (const s of body.steps) {
        await tx.pmoaProcessStep.create({
          data: {
            id: s.id || randomUUID(),
            processId: id,
            stepOrder: s.stepOrder,
            name: s.name,
            kind: s.kind,
            actorPositionId: s.actorPositionId ?? null,
            actorRoleName: s.actorRoleName ?? null,
            slaDescription: s.slaDescription ?? null,
            outgoing: Array.isArray(s.outgoing) ? s.outgoing : [],
          },
        });
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;
  const { id } = await params;

  const proc = await db.pmoaProcess.findFirst({ where: { id, orgId: scope.orgId } });
  if (!proc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.pmoaProcess.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
