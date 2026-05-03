import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';

export const dynamic = 'force-dynamic';

const CreateBody = z.object({
  name: z.string().min(1).max(300),
  positionNumber: z.string().max(50).nullish(),
  departmentId: z.string().uuid().nullish(),
  reportsToId: z.string().uuid().nullish(),
  currentHolderName: z.string().max(200).nullish(),
  vacancy: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
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
    const parent = await db.pmoaPosition.findFirst({ where: { id: reportsToId, orgId: scope.orgId } });
    if (!parent) return NextResponse.json({ error: 'Reports-to position not found' }, { status: 404 });
  }

  const position = await db.pmoaPosition.create({
    data: {
      id: randomUUID(),
      orgId: scope.orgId,
      name: name.trim(),
      positionNumber: positionNumber?.trim() || null,
      departmentId: departmentId || null,
      reportsToId: reportsToId || null,
      currentHolderName: currentHolderName?.trim() || null,
      vacancy: vacancy ?? false,
      spanOfControl: 0,
      sourceDocumentIds: ['manual'],
    },
  });

  return NextResponse.json({ ok: true, position });
}
