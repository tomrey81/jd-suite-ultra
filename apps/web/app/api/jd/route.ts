import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';

const createJDSchema = z.object({
  templateId: z.string().uuid().optional(),
  data: z.record(z.string(), z.string().nullable()).default({}),
  jobTitle: z.string().default(''),
  jobCode: z.string().optional(),
  orgUnit: z.string().optional(),
  folder: z.string().nullable().optional(),
  careerFamily: z.string().nullable().optional(),
  duplicatedFromId: z.string().uuid().optional(),
});

// GET /api/jd
export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = session?.orgId;
  if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

  const url = new URL(req.url);
  const folder = url.searchParams.get('folder');
  const careerFamily = url.searchParams.get('careerFamily');
  const includeTrashed = url.searchParams.get('includeTrashed') === 'true';
  const trashedOnly = url.searchParams.get('trashedOnly') === 'true';

  const where: any = { orgId };
  if (trashedOnly) {
    where.archivedAt = { not: null };
  } else if (!includeTrashed) {
    where.archivedAt = null;
  }
  if (folder) where.folder = folder;
  if (careerFamily) where.careerFamily = careerFamily;

  const jds = await db.jobDescription.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    include: {
      owner: { select: { id: true, name: true, email: true } },
      template: { select: { id: true, name: true } },
      _count: { select: { comments: true, versions: true } },
    },
  });

  return NextResponse.json(jds);
}

// POST /api/jd
export async function POST(req: Request) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = session?.orgId;
  if (!orgId) return NextResponse.json({ error: 'No organisation' }, { status: 403 });

  try {
    const body = await req.json();
    const parsed = createJDSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
    }

    const { templateId, data, jobTitle, jobCode, orgUnit, folder, careerFamily, duplicatedFromId } = parsed.data;

    const jd = await db.$transaction(async (tx) => {
      const created = await tx.jobDescription.create({
        data: {
          orgId,
          ownerId: session!.user.id,
          templateId: templateId || undefined,
          data,
          jobTitle,
          jobCode,
          orgUnit,
          folder: folder || undefined,
          careerFamily: careerFamily || undefined,
          duplicatedFromId: duplicatedFromId || undefined,
          status: 'DRAFT',
        },
      });

      await tx.jDVersion.create({
        data: {
          jdId: created.id,
          authorId: session!.user.id,
          authorType: 'USER',
          changeType: 'IMPORT',
          note: duplicatedFromId ? 'Duplicated from existing JD' : 'JD created',
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
