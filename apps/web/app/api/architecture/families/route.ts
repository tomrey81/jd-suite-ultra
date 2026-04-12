import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';

export async function GET() {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = session.orgId;

  const families = await db.jobFamily.findMany({
    where: { orgId },
    include: {
      slots: {
        include: {
          jd: {
            include: { evalResults: { orderBy: { createdAt: 'desc' }, take: 1, select: { overallScore: true } } },
          },
        },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json({ families });
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  color: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const orgId = session.orgId;

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 });

  const count = await db.jobFamily.count({ where: { orgId } });
  const family = await db.jobFamily.create({
    data: {
      orgId: orgId!,
      name: parsed.data.name,
      description: parsed.data.description,
      color: parsed.data.color ?? '#8A7560',
      sortOrder: count,
    },
  });

  return NextResponse.json({ family }, { status: 201 });
}
