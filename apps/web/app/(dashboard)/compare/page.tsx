import { db } from '@jd-suite/db';
import { JDCompareView } from '@/components/compare/jd-compare-view';
import { DEFAULT_TEMPLATE_SECTIONS } from '@/lib/default-template';
import type { TemplateSection } from '@jd-suite/types';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'JD Compare',
};

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const sp = await searchParams;
  const selectedIds = sp?.ids ? sp.ids.split(',').filter(Boolean).slice(0, 4) : [];

  let allJDs: any[] = [];
  let selectedJDs: any[] = [];

  try {
    const org = await db.organisation.findFirst({ orderBy: { createdAt: 'asc' } });
    const orgId = org?.id ?? '';

    if (orgId) {
      allJDs = await db.jobDescription.findMany({
        where: { orgId },
        select: { id: true, jobTitle: true, orgUnit: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
      });

      if (selectedIds.length > 0) {
        selectedJDs = await db.jobDescription.findMany({
          where: { id: { in: selectedIds }, orgId },
          include: {
            template: true,
            evalResults: { orderBy: { createdAt: 'desc' }, take: 1 },
            owner: { select: { name: true } },
            versions: { orderBy: { timestamp: 'desc' }, take: 1 },
          },
        });

        // Enrich with sections
        selectedJDs = selectedJDs.map((jd) => ({
          ...jd,
          sections: (jd.template?.sections as TemplateSection[]) ?? DEFAULT_TEMPLATE_SECTIONS,
          data: (jd.data as Record<string, string>) ?? {},
        }));
      }
    }
  } catch {
    // DB not ready
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border-default bg-white px-6 py-4 shrink-0">
        <h1 className="font-display text-xl font-bold text-text-primary">JD Compare</h1>
        <p className="mt-1 text-xs text-text-secondary">
          Select up to 4 JDs to compare side by side — fields, scores, and evaluation results.
        </p>
      </div>
      <JDCompareView allJDs={allJDs} initialSelected={selectedJDs} />
    </div>
  );
}
