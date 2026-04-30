import { db } from '@jd-suite/db';
import { ArchitectureMatrix } from '@/components/architecture/architecture-matrix';
import { ArchitectureJDBar } from '@/components/architecture/architecture-jd-bar';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Job Architecture Matrix',
};

export default async function ArchitecturePage() {
  let families: any[] = [];
  let slots: any[] = [];
  let unplacedJDs: any[] = [];
  let allJDs: any[] = [];
  let orgId = '';

  try {
    const org = await db.organisation.findFirst({ orderBy: { createdAt: 'asc' } });
    orgId = org?.id ?? '';

    if (orgId) {
      [families, slots, unplacedJDs, allJDs] = await Promise.all([
        db.jobFamily.findMany({
          where: { orgId },
          include: {
            slots: {
              include: {
                jd: {
                  include: {
                    evalResults: { orderBy: { createdAt: 'desc' }, take: 1, select: { overallScore: true } },
                  },
                },
              },
            },
          },
          orderBy: { sortOrder: 'asc' },
        }),
        db.jobArchitectureSlot.findMany({
          where: { orgId },
          include: { jd: true, family: true },
        }),
        db.jobDescription.findMany({
          where: { orgId, architectureSlot: null, archivedAt: null },
          select: { id: true, jobTitle: true, orgUnit: true, jobCode: true, status: true, data: true },
          orderBy: { updatedAt: 'desc' },
        }),
        db.jobDescription.findMany({
          where: { orgId },
          select: {
            id: true,
            jobTitle: true,
            status: true,
            folder: true,
            orgUnit: true,
            architectureSlot: { select: { id: true } },
            evalResults: { take: 1, select: { id: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 500,
        }),
      ]);
    }
  } catch {
    // DB not ready
  }

  const jdLite = allJDs.map((j: any) => ({
    id: j.id,
    jobTitle: j.jobTitle || 'Untitled',
    status: j.status,
    folder: j.folder,
    orgUnit: j.orgUnit,
    hasSlot: !!j.architectureSlot,
    hasEval: (j.evalResults?.length ?? 0) > 0,
  }));

  return (
    <div className="flex h-full flex-col">
      <ArchitectureJDBar
        jds={jdLite}
        unplacedCount={unplacedJDs.length}
        totalPlaced={slots.length}
        familiesCount={families.length}
      />
      <div className="border-b border-border-default bg-white px-6 py-3 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-text-primary">Job Architecture Matrix</h1>
            <p className="mt-1 text-xs text-text-secondary">
              Map roles to job families and Axiomera bands (A1 entry → E5 executive). Drag a JD onto any cell.
              Cells highlight by Axiomera grade and show evaluation scores when available.
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <ArchitectureMatrix
          initialFamilies={families}
          unplacedJDs={unplacedJDs}
          orgId={orgId}
        />
      </div>
    </div>
  );
}
