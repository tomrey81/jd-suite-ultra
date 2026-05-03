import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { FLAGS } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!FLAGS.SEALED_PROGRAMS) {
    return NextResponse.json({ error: 'Not enabled' }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id;
  const { id } = await params;

  const program = await db.jdqProgram.findUnique({
    where: { id },
    select: { id: true, orgId: true, status: true, sealed: true },
  });
  if (!program) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const membership = await db.membership.findFirst({
    where: { userId, orgId: program.orgId },
  });
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const isAdminOrOwner =
    membership.role === 'ADMIN' || membership.role === 'OWNER';
  if (!isAdminOrOwner) {
    return NextResponse.json({ error: 'Only admins and owners can seal programs' }, { status: 403 });
  }

  if (program.status !== 'DRAFT') {
    return NextResponse.json(
      { error: `Cannot seal a program with status: ${program.status}` },
      { status: 400 },
    );
  }

  const updated = await db.jdqProgram.update({
    where: { id },
    data: {
      sealed: true,
      sealedAt: new Date(),
      sealedById: userId,
      status: 'SEALED',
    },
  });

  return NextResponse.json({ ok: true, program: updated });
}
