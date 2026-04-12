import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';

const ctx = { params: Promise<{ groupId: string }> };

// ── PATCH /api/pay-groups/[groupId] — rename group ──────────────────────────
const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
  color: z.string().optional(),
  comment: z.string().min(3).max(500), // always required
});

export async function PATCH(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { groupId } = await params;
  const orgId = session.orgId;

  const group = await db.payGroup.findFirst({ where: { id: groupId, orgId } });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }
  const { name, description, color, comment } = parsed.data;

  await db.$transaction([
    db.payGroup.update({
      where: { id: groupId },
      data: { name, description, color },
    }),
    db.payGroupAuditLog.create({
      data: {
        groupId,
        action: 'GROUP_RENAMED',
        fromGroup: group.name,
        toGroup: name ?? group.name,
        comment,
        authorId: session.user.id,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

// ── DELETE /api/pay-groups/[groupId] ─────────────────────────────────────────
export async function DELETE(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { groupId } = await params;
  const orgId = session.orgId;

  const group = await db.payGroup.findFirst({ where: { id: groupId, orgId } });
  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.payGroup.delete({ where: { id: groupId } });
  return NextResponse.json({ ok: true });
}
