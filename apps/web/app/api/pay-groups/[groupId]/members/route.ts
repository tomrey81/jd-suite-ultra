import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';

// ── POST /api/pay-groups/[groupId]/members — add JD to group ─────────────────
const addSchema = z.object({
  jdId: z.string().min(1),
  comment: z.string().min(3).max(500), // MANDATORY per EUPTD audit requirements
});

export async function POST(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { groupId } = await params;
  const orgId = session.orgId;

  const group = await db.payGroup.findFirst({ where: { id: groupId, orgId } });
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }
  const { jdId, comment } = parsed.data;

  // Verify JD belongs to org
  const jd = await db.jobDescription.findFirst({ where: { id: jdId, orgId } });
  if (!jd) return NextResponse.json({ error: 'JD not found' }, { status: 404 });

  // Check if JD is already in this group
  const existing = await db.payGroupMember.findFirst({ where: { groupId, jdId } });
  if (existing) return NextResponse.json({ error: 'JD already in this group' }, { status: 409 });

  await db.$transaction([
    db.payGroupMember.create({ data: { groupId, jdId, addedById: session.user.id } }),
    db.payGroupAuditLog.create({
      data: {
        groupId,
        jdId,
        action: 'JD_ADDED',
        toGroup: group.name,
        comment,
        authorId: session.user.id,
      },
    }),
  ]);

  return NextResponse.json({ ok: true }, { status: 201 });
}

// ── DELETE /api/pay-groups/[groupId]/members?jdId=xxx ────────────────────────
const removeSchema = z.object({
  jdId: z.string().min(1),
  comment: z.string().min(3).max(500),
});

export async function DELETE(req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { groupId } = await params;
  const orgId = session.orgId;

  const group = await db.payGroup.findFirst({ where: { id: groupId, orgId } });
  if (!group) return NextResponse.json({ error: 'Group not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed, comment is required' }, { status: 400 });
  }
  const { jdId, comment } = parsed.data;

  await db.$transaction([
    db.payGroupMember.deleteMany({ where: { groupId, jdId } }),
    db.payGroupAuditLog.create({
      data: {
        groupId,
        jdId,
        action: 'JD_REMOVED',
        fromGroup: group.name,
        comment,
        authorId: session.user.id,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
