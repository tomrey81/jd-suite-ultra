import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';

export const dynamic = 'force-dynamic';

const CreateBody = z.object({
  name: z.string().min(1).max(300),
  parentId: z.string().uuid().nullish(),
});

export async function POST(req: NextRequest) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  const { name, parentId } = parsed.data;

  if (parentId) {
    const parent = await db.pmoaDepartment.findFirst({ where: { id: parentId, orgId: scope.orgId } });
    if (!parent) return NextResponse.json({ error: 'Parent department not found' }, { status: 404 });
  }

  const department = await db.pmoaDepartment.create({
    data: {
      id: randomUUID(),
      orgId: scope.orgId,
      name: name.trim(),
      parentId: parentId || null,
      headPositionId: null,
      sourceDocumentIds: ['manual'],
    },
  });

  return NextResponse.json({ ok: true, department });
}
