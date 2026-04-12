import { NextResponse } from 'next/server';
import { getSession } from '@/lib/get-session';
import { db } from '@jd-suite/db';
import { z } from 'zod';

const restoreSchema = z.object({
  versionId: z.string().min(1),
});

// POST /api/jd/[id]/restore — restore JD data from a historical version
// Non-destructive: saves current state as a new FIELD_EDIT version first
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const orgId = session?.orgId;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const parsed = restoreSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'versionId is required' }, { status: 400 });
  }

  const { versionId } = parsed.data;

  // Verify JD belongs to this org
  const jd = await db.jobDescription.findFirst({ where: { id, orgId } });
  if (!jd) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Fetch the target version — must be a FIELD_EDIT with snapshot data
  const targetVersion = await db.jDVersion.findFirst({
    where: { id: versionId, jdId: id, changeType: 'FIELD_EDIT' },
  });

  if (!targetVersion) {
    return NextResponse.json(
      { error: 'Version not found or not restorable (only FIELD_EDIT versions can be restored)' },
      { status: 404 },
    );
  }

  // data (Json?) stores the jd.data at the time of the edit
  const snapshotData = targetVersion.data as Record<string, string> | null;
  if (!snapshotData || typeof snapshotData !== 'object') {
    return NextResponse.json(
      { error: 'This version has no data snapshot — older entries may not support restore' },
      { status: 422 },
    );
  }

  await db.$transaction(async (tx) => {
    // Save current state as a pre-restore snapshot before overwriting
    await tx.jDVersion.create({
      data: {
        jdId: id,
        authorId: session!.user.id,
        authorType: 'USER',
        changeType: 'FIELD_EDIT',
        note: `Pre-restore snapshot (before restoring to version ${versionId.slice(0, 8)})`,
        data: jd.data as any,
      },
    });

    // Apply the historical snapshot as the current JD data
    await tx.jobDescription.update({
      where: { id },
      data: {
        data: snapshotData,
        jobTitle: snapshotData.jobTitle ?? jd.jobTitle,
        updatedAt: new Date(),
      },
    });

    // Record the restore action
    await tx.jDVersion.create({
      data: {
        jdId: id,
        authorId: session!.user.id,
        authorType: 'USER',
        changeType: 'FIELD_EDIT',
        note: `Restored from version ${versionId.slice(0, 8)} (${new Date(targetVersion.timestamp).toLocaleDateString()})`,
        data: snapshotData as any,
      },
    });
  });

  return NextResponse.json({ success: true });
}
