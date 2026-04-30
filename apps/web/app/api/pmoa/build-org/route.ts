import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';
import { buildOrgFromCorpus } from '@/lib/pmoa/builders';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST() {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  // Pull only validity-tagged docs that aren't outdated (per spec §0.8 ranking)
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
      error: 'No usable documents. Upload HRIS rosters / org charts / regulations first, then tag them as "recent" or "partially valid".',
    }, { status: 400 });
  }

  let result;
  try {
    result = await buildOrgFromCorpus(docs.map((d) => ({ id: d.id, name: d.name, rawText: d.rawText || '' })));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message || 'AI extraction failed' }, { status: 502 });
  }

  // Wipe and replace — for v1 we don't merge with manual edits.
  // Future: surface a diff before commit.
  const created = await db.$transaction(async (tx) => {
    await tx.pmoaAssignment.deleteMany({ where: { orgId: scope.orgId } });
    await tx.pmoaPosition.deleteMany({ where: { orgId: scope.orgId } });
    await tx.pmoaDepartment.deleteMany({ where: { orgId: scope.orgId } });

    // Create departments first; map name → id
    const deptIdByName = new Map<string, string>();
    for (const d of result.departments) {
      const id = randomUUID();
      deptIdByName.set(d.name, id);
      await tx.pmoaDepartment.create({
        data: {
          id,
          orgId: scope.orgId,
          name: d.name,
          parentId: null, // resolve in pass 2
          headPositionId: null,
          sourceDocumentIds: d.sourceDocumentIds || [],
        },
      });
    }
    // Resolve dept parents
    for (const d of result.departments) {
      if (d.parent && deptIdByName.has(d.parent) && deptIdByName.has(d.name)) {
        await tx.pmoaDepartment.update({
          where: { id: deptIdByName.get(d.name)! },
          data: { parentId: deptIdByName.get(d.parent)! },
        });
      }
    }

    // Positions, dedup by name
    const posIdByName = new Map<string, string>();
    for (const p of result.positions) {
      if (posIdByName.has(p.name)) continue;
      const id = randomUUID();
      posIdByName.set(p.name, id);
      await tx.pmoaPosition.create({
        data: {
          id,
          orgId: scope.orgId,
          departmentId: p.department ? deptIdByName.get(p.department) ?? null : null,
          name: p.name,
          positionNumber: p.positionNumber,
          reportsToId: null, // resolve pass 2
          currentHolderName: p.currentHolderName,
          vacancy: !!p.vacancy,
          spanOfControl: Math.max(0, p.spanOfControl || 0),
          sourceDocumentIds: p.sourceDocumentIds || [],
        },
      });
    }
    // Resolve reportsTo
    for (const p of result.positions) {
      if (p.reportsTo && posIdByName.has(p.reportsTo) && posIdByName.has(p.name)) {
        await tx.pmoaPosition.update({
          where: { id: posIdByName.get(p.name)! },
          data: { reportsToId: posIdByName.get(p.reportsTo)! },
        });
      }
    }
    // Resolve dept heads
    for (const d of result.departments) {
      if (d.headPositionName && posIdByName.has(d.headPositionName) && deptIdByName.has(d.name)) {
        await tx.pmoaDepartment.update({
          where: { id: deptIdByName.get(d.name)! },
          data: { headPositionId: posIdByName.get(d.headPositionName)! },
        });
      }
    }

    // Assignments
    let acc = 0;
    for (const a of result.assignments) {
      if (!posIdByName.has(a.positionName)) continue;
      await tx.pmoaAssignment.create({
        data: {
          id: randomUUID(),
          orgId: scope.orgId,
          positionId: posIdByName.get(a.positionName)!,
          personName: a.personName,
          kind: a.kind,
          splitAllocations: a.kind === 'split' && a.splitWithPosition && a.splitPct
            ? [{ positionName: a.splitWithPosition, pct: a.splitPct }]
            : undefined,
        },
      });
      acc++;
    }
    return {
      departments: deptIdByName.size,
      positions: posIdByName.size,
      assignments: acc,
    };
  });

  return NextResponse.json({
    ok: true,
    created,
    globalClarifications: result.globalClarifications,
  });
}
