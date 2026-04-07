import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { z } from 'zod';

const createJDSchema = z.object({
  templateId: z.string().uuid().optional(),
  data: z.record(z.string(), z.string().nullable()).default({}),
  jobTitle: z.string().default(''),
  jobCode: z.string().optional(),
  orgUnit: z.string().optional(),
});

// GET /api/jd — list JDs for the user's org
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session as any).orgId;
  if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

  const jds = await db.jobDescription.findMany({
    where: { orgId },
    orderBy: { updatedAt: 'desc' },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      template: { select: { id: true, name: true } },
      _count: { select: { comments: true, versions: true } },
    },
  });

  return NextResponse.json(jds);
}

// POST /api/jd — create a new JD
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session as any).orgId;
  if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = createJDSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { templateId, data, jobTitle, jobCode, orgUnit } = parsed.data;

    const jd = await db.$transaction(async (tx) => {
      const created = await tx.jobDescription.create({
        data: {
          orgId,
          ownerId: session.user.id,
          templateId: templateId || undefined,
          data,
          jobTitle,
          jobCode,
          orgUnit,
          status: 'DRAFT',
        },
      });

      // Create audit trail entry
      await tx.jDVersion.create({
        data: {
          jdId: created.id,
          authorId: session.user.id,
          authorType: 'USER',
          changeType: 'IMPORT',
          note: 'JD created',
          data,
        },
      });

      return created;
    });

    return NextResponse.json(jd, { status: 201 });
  } catch (error) {
    console.error('Create JD error:', error);
    return NextResponse.json({ error: 'Failed to create JD' }, { status: 500 });
  }
}
