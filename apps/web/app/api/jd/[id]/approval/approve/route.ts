import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { FLAGS } from '@/lib/feature-flags';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

const STAGE_MACHINE: Record<string, string> = {
  MANAGER_VALIDATION: 'HR_REVIEW',
  HR_REVIEW: 'GOVERNANCE_APPROVAL',
  GOVERNANCE_APPROVAL: 'APPROVED',
};

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

  // Only admins and owners can approve
  const isAdminOrOwner =
    membership.role === 'ADMIN' || membership.role === 'OWNER';
  if (!isAdminOrOwner) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const currentStage = jd.status as string;
  const toStage = STAGE_MACHINE[currentStage];
  if (!toStage) {
    return NextResponse.json(
      { error: `Cannot approve from status: ${currentStage}` },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const comment: string | undefined = body?.comment;

  // Map to JDStatus enum value
  const newJDStatus =
    toStage === 'APPROVED'
      ? ('APPROVED' as const)
      : ('UNDER_REVISION' as const);

  const result = await db.$transaction(async (tx) => {
    const version = await tx.jDVersion.create({
      data: {
        id: randomUUID(),
        jdId: jd.id,
        authorId: userId,
        changeType: 'STATUS_CHANGE',
        oldValue: currentStage,
        newValue: toStage,
        note: comment || null,
      },
    });
    const record = await tx.approvalRecord.create({
      data: {
        id: randomUUID(),
        jdId: jd.id,
        jdVersionId: version.id,
        fromStage: currentStage,
        toStage,
        action: 'APPROVE',
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
