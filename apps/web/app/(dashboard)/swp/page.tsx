import { auth } from '@/lib/auth';
import { db } from '@jd-suite/db';
import { redirect } from 'next/navigation';

export default async function SWPPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const orgId = (session as any).orgId;
  if (!orgId) redirect('/');

  const jds = await db.jobDescription.findMany({
    where: { orgId },
    include: { evalResults: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  const evaluated = jds.filter((jd) => jd.evalResults.length > 0);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[900px]">
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">Strategic Workforce Planning</h1>
        <p className="mb-6 text-[13px] text-text-secondary">
          OTIF-powered workforce intelligence. Based on O-Ring AI risk analysis across all evaluated JDs in workspace.
        </p>

        {evaluated.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-white p-12 text-center text-[13px] text-text-muted">
            No JDs with evaluation data yet. Open a JD and click &quot;Evaluate&quot; to populate SWP signals.
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="mb-6 grid grid-cols-4 gap-3.5">
              {[
                { l: 'JDs evaluated', v: evaluated.length, col: 'text-text-primary' },
                {
                  l: 'Criteria gaps (avg)',
                  v: Math.round(evaluated.reduce((a, d) => a + ((d.evalResults[0]?.criteria as any[]) || []).filter((c: any) => c.status === 'insufficient').length, 0) / evaluated.length),
                  col: 'text-danger',
                },
                {
                  l: 'Partial (avg)',
                  v: Math.round(evaluated.reduce((a, d) => a + ((d.evalResults[0]?.criteria as any[]) || []).filter((c: any) => c.status === 'partial').length, 0) / evaluated.length),
                  col: 'text-warning',
                },
                { l: 'Avg DC', v: '-', col: 'text-success' },
              ].map(({ l, v, col }) => (
                <div key={l} className="rounded-lg border border-border-default bg-white p-[18px] text-center">
                  <div className={`font-display text-3xl font-bold ${col}`}>{v}</div>
                  <div className="mt-1 text-[11px] text-text-muted">{l}</div>
                </div>
              ))}
            </div>

            {/* Role readiness */}
            <div className="rounded-lg border border-border-default bg-white p-[22px]">
              <h2 className="mb-3.5 font-display text-[0.95rem] font-semibold">JD Quality — Role Readiness for Pay Equity</h2>
              {evaluated.map((d) => {
                const criteria = (d.evalResults[0]?.criteria as any[]) || [];
                const suf = criteria.filter((c: any) => c.status === 'sufficient').length;
                const gaps = criteria.filter((c: any) => c.status === 'insufficient').length;
                return (
                  <div key={d.id} className="flex items-center gap-3 border-b border-border-default py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-text-primary">{d.jobTitle || 'Untitled'}</div>
                      <div className="text-[11px] text-text-muted">{d.orgUnit || '-'}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-success-bg px-[7px] py-0.5 text-[10px] font-semibold text-success">{suf} OK</span>
                      {gaps > 0 && <span className="rounded bg-danger-bg px-[7px] py-0.5 text-[10px] font-semibold text-danger">{gaps} gaps</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
