import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { requireOrgScope, isScopeError } from '@/lib/pmoa/auth-scope';

export const dynamic = 'force-dynamic';

const ALLOWED_FLAGS = new Set(['recent', 'partially_valid', 'outdated']);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { validityFlag?: string; validityNote?: string; documentOwnerId?: string }
    | null;
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.validityFlag) {
    if (!ALLOWED_FLAGS.has(body.validityFlag)) {
      return NextResponse.json({ error: 'Invalid validityFlag' }, { status: 400 });
    }
    data.validityFlag = body.validityFlag;
  }
  if (typeof body.validityNote === 'string') data.validityNote = body.validityNote.slice(0, 2000);
  if (typeof body.documentOwnerId === 'string') data.documentOwnerId = body.documentOwnerId;
  data.updatedAt = new Date();

  // Guard tenant
  const doc = await db.pmoaDocument.findFirst({ where: { id, orgId: scope.orgId } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.pmoaDocument.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const scope = await requireOrgScope();
  if (isScopeError(scope)) return scope;
  const { id } = await params;
  const doc = await db.pmoaDocument.findFirst({ where: { id, orgId: scope.orgId } });
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await db.pmoaDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
