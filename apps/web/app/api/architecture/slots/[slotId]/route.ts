import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';

export async function DELETE(_req: Request, { params }: { params: Promise<{ slotId: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = session.orgId;
  const { slotId } = await params;

  const slot = await db.jobArchitectureSlot.findFirst({ where: { id: slotId, orgId } });
  if (!slot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.jobArchitectureSlot.delete({ where: { id: slotId } });
  return NextResponse.json({ ok: true });
}
