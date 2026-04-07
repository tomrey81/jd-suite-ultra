import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { z } from 'zod';

const updateJDSchema = z.object({
  data: z.record(z.string(), z.string().nullable()).optional(),
  jobTitle: z.string().optional(),
  jobCode: z.string().nullable().optional(),
  orgUnit: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'UNDER_REVISION', 'APPROVED', 'ARCHIVED']).optional(),
  fieldChanged: z.string().optional(),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
});

// GET /api/jd/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session as any).orgId;
  const { id } = await params;

  const jd = await db.jobDescription.findFirst({
    where: { id, orgId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      template: true,
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      evalResults: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      versions: {
        orderBy: { timestamp: 'desc' },
        take: 50,
      },
    },
  });

  if (!jd) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(jd);
}

// PATCH /api/jd/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session as any).orgId;
  const { id } = await params;

  // Verify ownership
  const existing = await db.jobDescription.findFirst({ where: { id, orgId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const body = await req.json();
    const parsed = updateJDSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }

    const updates = parsed.data;

    const jd = await db.$transaction(async (tx) => {
      const updateData: Record<string, unknown> = {};
      if (updates.data !== undefined) updateData.data = updates.data;
      if (updates.jobTitle !== undefined) updateData.jobTitle = updates.jobTitle;
      if (updates.jobCode !== undefined) updateData.jobCode = updates.jobCode;
      if (updates.orgUnit !== undefined) updateData.orgUnit = updates.orgUnit;
      if (updates.status !== undefined) updateData.status = updates.status;

      const updated = await tx.jobDescription.update({
        where: { id },
        data: updateData,
      });

      // Create audit trail
      const changeType = updates.status ? 'STATUS_CHANGE' : 'FIELD_EDIT';
      await tx.jDVersion.create({
        data: {
          jdId: id,
          authorId: session.user.id,
          authorType: 'USER',
          changeType,
          fieldChanged: updates.fieldChanged || (updates.status ? 'status' : undefined),
          oldValue: updates.oldValue || (updates.status ? existing.status : undefined),
          newValue: updates.newValue || updates.status || undefined,
          note: updates.status ? `Status changed to ${updates.status}` : undefined,
        },
      });

      return updated;
    });

    return NextResponse.json(jd);
  } catch (error) {
    console.error('Update JD error:', error);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

// DELETE /api/jd/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session as any).orgId;
  const { id } = await params;

  const existing = await db.jobDescription.findFirst({ where: { id, orgId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.jobDescription.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
