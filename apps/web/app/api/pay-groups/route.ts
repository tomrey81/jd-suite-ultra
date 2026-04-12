import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';

// ── GET /api/pay-groups  — list all groups + members for the org ─────────────
export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = session.orgId;

  const groups = await db.payGroup.findMany({
    where: { orgId },
    include: {
      members: {
        include: {
          jd: {
            include: {
              evalResults: { orderBy: { createdAt: 'desc' }, take: 1 },
              owner: { select: { name: true } },
            },
          },
        },
      },
      auditLog: { orderBy: { timestamp: 'desc' }, take: 50 },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json({ groups });
}

// ── POST /api/pay-groups  — create group ──────────────────────────────────────
const createGroupSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  color: z.string().optional(),
  comment: z.string().min(3).max(500),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = session.orgId;

  const body = await req.json().catch(() => null);
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 });
  }
  const { name, description, color, comment } = parsed.data;

  const count = await db.payGroup.count({ where: { orgId } });

  const group = await db.payGroup.create({
    data: {
      orgId: orgId!,
      name,
      description,
      color: color ?? '#8A7560',
      sortOrder: count,
      auditLog: {
        create: {
          action: 'GROUP_CREATED',
          comment,
          authorId: session.user.id,
        },
      },
    },
    include: { members: true, auditLog: true },
  });

  return NextResponse.json({ group }, { status: 201 });
}
