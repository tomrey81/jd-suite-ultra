import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { FLAGS } from '@/lib/feature-flags';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!FLAGS.APPROVAL_WORKFLOW) {
    return NextResponse.json({ error: 'Not enabled' }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const jd = await db.jobDescription.findUnique({
    where: { id },
    select: { id: true, orgId: true, status: true, ownerId: true },
  });
  if (!jd) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const membership = await db.membership.findFirst({
    where: { userId, orgId: jd.orgId },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (jd.status !== 'DRAFT') {
    return NextResponse.json(
      { error: 'JD must be in DRAFT status to advance' },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const comment: string | undefined = body?.comment;

  const toStage = 'MANAGER_VALIDATION';
  const newJDStatus = 'UNDER_REVISION' as const;

  const result = await db.$transaction(async (tx) => {
    const version = await tx.jDVersion.create({
      data: {
        id: randomUUID(),
        jdId: jd.id,
        authorId: userId,
        changeType: 'STATUS_CHANGE',
        oldValue: jd.status,
        newValue: toStage,
        note: comment || null,
      },
    });
    const record = await tx.approvalRecord.create({
      data: {
        id: randomUUID(),
        jdId: jd.id,
        jdVersionId: version.id,
        fromStage: jd.status,
        toStage,
        action: 'ADVANCE',
        actorId: userId,
        comment: comment || null,
      },
    });
    await tx.jobDescription.update({
      where: { id: jd.id },
      data: { status: newJDStatus },
    });
    return { version, record };
  });

  return NextResponse.json({ ok: true, toStage, recordId: result.record.id });
}
