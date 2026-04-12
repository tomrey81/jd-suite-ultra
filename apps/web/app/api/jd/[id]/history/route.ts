import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';

// GET /api/jd/[id]/history — audit trail
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = session?.orgId;
  const { id } = await params;

  const jd = await db.jobDescription.findFirst({ where: { id, orgId } });
  if (!jd) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const versions = await db.jDVersion.findMany({
    where: { jdId: id },
    orderBy: { timestamp: 'desc' },
    take: 200,
    include: { author: { select: { name: true, email: true } } },
  });

  return NextResponse.json(versions);
}
