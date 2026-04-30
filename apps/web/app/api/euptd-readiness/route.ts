import { NextRequest, NextResponse } from 'next/server';
import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';
import { randomUUID } from 'node:crypto';
import { CHECKLIST, type Answer } from '@/lib/euptd/checklist';

export const dynamic = 'force-dynamic';

async function scope() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const m = await db.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { org: { createdAt: 'desc' } },
    select: { orgId: true },
  });
  if (!m) return null;
  return { userId: session.user.id, orgId: m.orgId };
}

export async function GET() {
  const s = await scope();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [rows, members] = await Promise.all([
    db.euptdReadinessResponse.findMany({ where: { orgId: s.orgId } }),
    db.membership.findMany({
      where: { orgId: s.orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  const answers: Record<string, {
    answer: Answer; note: string | null; updatedAt: string;
    assignedToId: string | null;
  }> = {};
  for (const r of rows) {
    answers[r.itemId] = {
      answer: r.answer as Answer,
      note: r.note,
      updatedAt: r.updatedAt.toISOString(),
      assignedToId: r.assignedToId,
    };
  }
  return NextResponse.json({
    answers,
    members: members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
    })),
  });
}

interface PatchBody {
  itemId: string;
  // Either action: full upsert with answer, or assign-only
  answer?: Answer;
  note?: string | null;
  assignedToId?: string | null;
}

const VALID_ANSWERS: Answer[] = ['yes', 'partial', 'no', 'na'];

export async function PATCH(req: NextRequest) {
  const s = await scope();
  if (!s) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json().catch(() => null)) as PatchBody | null;
  if (!body || !body.itemId) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  if (!CHECKLIST.find((i) => i.id === body.itemId)) {
    return NextResponse.json({ error: 'Unknown itemId' }, { status: 400 });
  }
  if (body.answer !== undefined && !VALID_ANSWERS.includes(body.answer)) {
    return NextResponse.json({ error: 'Invalid answer' }, { status: 400 });
  }

  const existing = await db.euptdReadinessResponse.findUnique({
    where: { orgId_itemId: { orgId: s.orgId, itemId: body.itemId } },
  });

  const note = typeof body.note === 'string' ? body.note.slice(0, 2000) : undefined;
  const assignedToId = body.assignedToId === undefined ? undefined : body.assignedToId;

  if (existing) {
    await db.euptdReadinessResponse.update({
      where: { id: existing.id },
      data: {
        ...(body.answer !== undefined ? { answer: body.answer, answeredById: s.userId } : {}),
        ...(note !== undefined ? { note } : {}),
        ...(assignedToId !== undefined ? { assignedToId } : {}),
        updatedAt: new Date(),
      },
    });
  } else {
    // Need an answer to create — assignment-only without answer creates with placeholder 'na'
    await db.euptdReadinessResponse.create({
      data: {
        id: randomUUID(),
        orgId: s.orgId,
        itemId: body.itemId,
        answer: body.answer ?? 'na',
        note: note ?? null,
        answeredById: body.answer !== undefined ? s.userId : null,
        assignedToId: assignedToId ?? null,
      },
    });
  }
  return NextResponse.json({ ok: true });
}
