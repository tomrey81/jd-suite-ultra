import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';

const updateJDSchema = z.object({
  data: z.record(z.string(), z.string().nullable()).optional(),
  jobTitle: z.string().optional(),
  jobCode: z.string().nullable().optional(),
  orgUnit: z.string().nullable().optional(),
  status: z.enum(['DRAFT', 'UNDER_REVISION', 'APPROVED', 'ARCHIVED']).optional(),
  folder: z.string().nullable().optional(),
  sortOrder: z.number().optional(),
  careerFamily: z.string().nullable().optional(),
  archivedAt: z.string().nullable().optional(), // ISO string or null to restore
  fieldChanged: z.string().optional(),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
});

// GET /api/jd/[id]
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = session?.orgId;
  const { id } = await params;

  const jd = await db.jobDescription.findFirst({
    where: { id, orgId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      template: true,
      comments: { orderBy: { createdAt: 'desc' }, take: 50 },
      evalResults: { orderBy: { createdAt: 'desc' }, take: 1 },
      versions: { orderBy: { timestamp: 'desc' }, take: 50 },
    },
  });

  if (!jd) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(jd);
}

// PATCH /api/jd/[id]
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = session?.orgId;
  const { id } = await params;

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
      if (updates.folder !== undefined) updateData.folder = updates.folder;
      if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
      if (updates.careerFamily !== undefined) updateData.careerFamily = updates.careerFamily;
      if (updates.archivedAt !== undefined) {
        updateData.archivedAt = updates.archivedAt ? new Date(updates.archivedAt) : null;
      }

      const updated = await tx.jobDescription.update({
        where: { id },
        data: updateData,
      });

      // Audit trail
      let changeType: 'STATUS_CHANGE' | 'FIELD_EDIT' = 'FIELD_EDIT';
      let note: string | undefined;

      if (updates.status) {
        changeType = 'STATUS_CHANGE';
        note = `Status changed to ${updates.status}`;
      } else if (updates.archivedAt !== undefined) {
        note = updates.archivedAt ? 'Moved to trash' : 'Restored from trash';
      } else if (updates.folder !== undefined) {
        note = updates.folder ? `Moved to folder "${updates.folder}"` : 'Removed from folder';
      } else if (updates.careerFamily !== undefined) {
        note = updates.careerFamily ? `Assigned to career family "${updates.careerFamily}"` : 'Removed from career family';
      } else if (updates.jobTitle !== undefined) {
        note = `Title changed to "${updates.jobTitle}"`;
      }

      if (note) {
        await tx.jDVersion.create({
          data: {
            jdId: id,
            authorId: session!.user.id,
            authorType: 'USER',
            changeType,
            fieldChanged: updates.fieldChanged || undefined,
            oldValue: updates.oldValue || undefined,
            newValue: updates.newValue || updates.status || undefined,
            note,
          },
        });
      }

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
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = session?.orgId;
  const { id } = await params;

  const existing = await db.jobDescription.findFirst({ where: { id, orgId } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.jobDescription.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
