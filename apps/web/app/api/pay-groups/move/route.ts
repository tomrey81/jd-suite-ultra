import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';

// ── POST /api/pay-groups/move — move JD from one group to another ─────────────
// Every move requires a mandatory comment per EUPTD Article 4 audit trail
const moveSchema = z.object({
  jdId: z.string().min(1),
  fromGroupId: z.string().min(1),
  toGroupId: z.string().min(1),
  comment: z.string().min(10, 'Comment must be at least 10 characters — explain why this JD is moving groups').max(1000),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = session.orgId;

  const body = await req.json().catch(() => null);
  const parsed = moveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }
  const { jdId, fromGroupId, toGroupId, comment } = parsed.data;

  if (fromGroupId === toGroupId) {
    return NextResponse.json({ error: 'Source and destination groups are the same' }, { status: 400 });
  }

  const [fromGroup, toGroup, jd] = await Promise.all([
    db.payGroup.findFirst({ where: { id: fromGroupId, orgId } }),
    db.payGroup.findFirst({ where: { id: toGroupId, orgId } }),
    db.jobDescription.findFirst({ where: { id: jdId, orgId } }),
  ]);

  if (!fromGroup) return NextResponse.json({ error: 'Source group not found' }, { status: 404 });
  if (!toGroup)   return NextResponse.json({ error: 'Destination group not found' }, { status: 404 });
  if (!jd)        return NextResponse.json({ error: 'JD not found' }, { status: 404 });

  // Transaction: remove from source, add to destination, log both
  await db.$transaction([
    db.payGroupMember.deleteMany({ where: { groupId: fromGroupId, jdId } }),
    db.payGroupMember.create({ data: { groupId: toGroupId, jdId, addedById: session.user.id } }),
    // Log in source group
    db.payGroupAuditLog.create({
      data: {
        groupId: fromGroupId,
        jdId,
        action: 'JD_MOVED',
        fromGroup: fromGroup.name,
        toGroup: toGroup.name,
        comment,
        authorId: session.user.id,
      },
    }),
    // Log in destination group
    db.payGroupAuditLog.create({
      data: {
        groupId: toGroupId,
        jdId,
        action: 'JD_MOVED',
        fromGroup: fromGroup.name,
        toGroup: toGroup.name,
        comment,
        authorId: session.user.id,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, from: fromGroup.name, to: toGroup.name });
}
