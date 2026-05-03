import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { FLAGS } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

const STAGE_ORDER = [
  'DRAFT',
  'MANAGER_VALIDATION',
  'HR_REVIEW',
  'GOVERNANCE_APPROVAL',
  'APPROVED',
  'PUBLISHED',
  'REJECTED',
  'ARCHIVED',
] as const;

type Stage = (typeof STAGE_ORDER)[number];

const STAGE_COLORS: Record<string, string> = {
  DRAFT: 'gray',
  MANAGER_VALIDATION: 'blue',
  HR_REVIEW: 'teal',
  GOVERNANCE_APPROVAL: 'purple',
  APPROVED: 'green',
  PUBLISHED: 'amber',
  REJECTED: 'red',
  ARCHIVED: 'stone',
};

function getNextActions(
  currentStage: string,
  isAdminOrOwner: boolean,
): Array<{ action: string; label: string; requiresComment: boolean }> {
  const terminal = ['APPROVED', 'PUBLISHED', 'REJECTED', 'ARCHIVED'];
  if (terminal.includes(currentStage)) {
    if (currentStage === 'REJECTED') {
      return [
        { action: 'resubmit', label: 'Resubmit', requiresComment: false },
      ];
    }
    return [];
  }

  const actions: Array<{ action: string; label: string; requiresComment: boolean }> = [];

  if (currentStage === 'DRAFT') {
    actions.push({ action: 'advance', label: 'Submit for Review', requiresComment: false });
  } else {
    // Non-draft non-terminal
    if (isAdminOrOwner) {
      actions.push({ action: 'approve', label: 'Approve', requiresComment: false });
      actions.push({ action: 'reject', label: 'Reject', requiresComment: true });
    }
    actions.push({ action: 'withdraw', label: 'Withdraw', requiresComment: false });
  }

  return actions;
}

export async function GET(
  _req: NextRequest,
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

  const isAdminOrOwner =
    membership.role === 'ADMIN' ||
    membership.role === 'OWNER' ||
    jd.ownerId === userId;

  const history = await db.approvalRecord.findMany({
    where: { jdId: id },
    orderBy: { createdAt: 'desc' },
  });

  const currentStage = jd.status as string;
  const color = STAGE_COLORS[currentStage] ?? 'gray';
  const nextActions = getNextActions(currentStage, isAdminOrOwner);

  return NextResponse.json({
    history,
    currentStage,
    stageColor: color,
    nextActions,
  });
}
