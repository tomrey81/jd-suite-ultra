import { db } from '@jd-suite/db';
import { PayGroupBoard } from '@/components/pay-groups/pay-group-board';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Pay Groups — EUPTD 2023/970',
};

export default async function PayGroupsPage() {
  // Use bypass orgId for demo (same pattern as rest of app)
  let orgId = '';
  let groups: any[] = [];
  let allJDs: any[] = [];

  try {
    const org = await db.organisation.findFirst({ orderBy: { createdAt: 'asc' } });
    orgId = org?.id ?? '';

    if (orgId) {
      [groups, allJDs] = await Promise.all([
        db.payGroup.findMany({
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
        }),
        db.jobDescription.findMany({
          where: { orgId },
          select: {
            id: true,
            jobTitle: true,
            orgUnit: true,
            status: true,
            data: true,
            evalResults: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { overallScore: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);
    }
  } catch {
    // DB may not be ready
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border-default bg-white px-6 py-4 shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-xl font-bold text-text-primary">Pay Group Creator</h1>
            <p className="mt-1 text-xs text-text-secondary max-w-2xl">
              Group roles by work of equal value per{' '}
              <a
                href="https://eur-lex.europa.eu/eli/dir/2023/970/oj/eng"
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-gold hover:underline"
              >
                EU Pay Transparency Directive 2023/970 Article 4
              </a>
              . Every decision is timestamped and commented — forming a defensible audit trail.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Criteria (EUPTD Art. 4)</div>
              <div className="flex gap-1.5 mt-1">
                {['Skills', 'Effort', 'Responsibility', 'Working Conditions'].map((c) => (
                  <span
                    key={c}
                    className="rounded border border-brand-gold/30 bg-brand-gold-light px-1.5 py-0.5 text-[9px] font-semibold text-brand-gold"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Info callout */}
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800">
          <strong>Audit requirements:</strong> Every grouping action requires a written justification. This is stored with a timestamp and forms your Article 4 compliance documentation. AI-generated groupings are clearly marked and require human review before finalisation.
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        {allJDs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-2 text-3xl">⊞</div>
              <div className="text-sm font-semibold text-text-primary">No JDs available</div>
              <div className="mt-1 text-xs text-text-muted">
                Create JDs in the workspace first, then group them here.
              </div>
            </div>
          </div>
        ) : (
          <PayGroupBoard initialGroups={groups} allJDs={allJDs} orgId={orgId} />
        )}
      </div>
    </div>
  );
}
