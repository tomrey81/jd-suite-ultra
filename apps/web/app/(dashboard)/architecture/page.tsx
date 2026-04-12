import { db } from '@jd-suite/db';
import { ArchitectureMatrix } from '@/components/architecture/architecture-matrix';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Job Architecture Matrix — Quadrance',
};

export default async function ArchitecturePage() {
  let families: any[] = [];
  let slots: any[] = [];
  let unplacedJDs: any[] = [];
  let orgId = '';

  try {
    const org = await db.organisation.findFirst({ orderBy: { createdAt: 'asc' } });
    orgId = org?.id ?? '';

    if (orgId) {
      [families, slots, unplacedJDs] = await Promise.all([
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
          where: {
            orgId,
            architectureSlot: null,
          },
          select: { id: true, jobTitle: true, orgUnit: true, status: true, data: true },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);
    }
  } catch {
    // DB not ready
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-default bg-white px-6 py-4 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-text-primary">Job Architecture Matrix</h1>
            <p className="mt-1 text-xs text-text-secondary">
              Map roles to job families and grade levels. Build career paths and identify gaps in your workforce structure.
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
              {families.length} families · {slots.length} roles placed
            </div>
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
