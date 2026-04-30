import Link from 'next/link';
import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { computeTasks, TASK_KIND_META, type TaskKind, type CommandCenterTask } from '@/lib/command-center/tasks';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Command Center — JD Suite' };

export default async function CommandCenterPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/command-center');

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { org: { createdAt: 'desc' } },
    select: { orgId: true },
  });
  const orgId = membership?.orgId;

  let tasks: CommandCenterTask[] = [];
  let totalJDs = 0;

  if (orgId) {
    const jds = await db.jobDescription.findMany({
      where: { orgId, archivedAt: null },
      select: {
        id: true,
        jobTitle: true,
        status: true,
        updatedAt: true,
        architectureSlot: { select: { level: true } },
        evalResults: { take: 1, orderBy: { createdAt: 'desc' }, select: { overallScore: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    totalJDs = jds.length;

    const jdInputs = jds.map((j) => ({
      id: j.id,
      jobTitle: j.jobTitle || 'Untitled',
      status: j.status,
      updatedAt: j.updatedAt,
      hasSlot: !!j.architectureSlot,
      hasEval: j.evalResults.length > 0,
      evalScore: j.evalResults[0]?.overallScore,
      slotLevel: j.architectureSlot?.level,
    }));

    tasks = computeTasks(jdInputs);
  }

  // Group by kind for display
  const byKind: Record<TaskKind, CommandCenterTask[]> = {} as any;
  for (const k of Object.keys(TASK_KIND_META) as TaskKind[]) byKind[k] = [];
  for (const t of tasks) byKind[t.kind].push(t);

  const totalHigh = tasks.filter((t) => t.priority === 'high').length;
  const totalMed = tasks.filter((t) => t.priority === 'medium').length;
  const totalLow = tasks.filter((t) => t.priority === 'low').length;

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-gold">
          Final Review · Workflow
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
          Command Center
        </h1>
        <p className="mt-2 max-w-[700px] text-[14px] leading-relaxed text-text-secondary">
          Tasks computed from current JD state. Each item below requires action: prepare a missing JD,
          review a stale draft, approve a revision, send for evaluation, place in the matrix, or verify
          a placement that drifted from its evaluation score.
        </p>

        {/* Stats strip */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total tasks" value={tasks.length} accent="text-text-primary" />
          <Stat label="High priority" value={totalHigh} accent="text-danger" />
          <Stat label="Medium" value={totalMed} accent="text-warning" />
          <Stat label="Low" value={totalLow} accent="text-text-muted" />
        </div>

        {/* JD coverage */}
        <div className="mt-3 rounded-lg border border-border-default bg-white p-4 text-xs text-text-secondary">
          <strong>{totalJDs}</strong> active JD{totalJDs === 1 ? '' : 's'} in scope ·{' '}
          <strong>{tasks.length}</strong> {tasks.length === 1 ? 'item needs' : 'items need'} attention.
          {tasks.length === 0 && totalJDs > 0 && (
            <span className="ml-2 text-success">All clear — no actions required.</span>
          )}
        </div>

        {tasks.length === 0 && totalJDs === 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-border-default bg-white p-12 text-center">
            <p className="text-sm text-text-muted">No JDs in scope yet.</p>
            <Link
              href="/jd/new"
              className="mt-4 inline-block rounded-full bg-brand-gold px-4 py-2 text-xs font-medium text-white"
            >
              + Create first JD
            </Link>
          </div>
        )}

        {/* Grouped by kind */}
        <div className="mt-6 space-y-5">
          {(Object.keys(byKind) as TaskKind[]).map((kind) => {
            const list = byKind[kind];
            if (list.length === 0) return null;
            const meta = TASK_KIND_META[kind];
            return (
              <div key={kind} className="rounded-xl border border-border-default bg-white">
                <div className="flex items-center gap-2 border-b border-border-default px-4 py-3">
                  <span className="text-base" style={{ color: meta.color }}>{meta.icon}</span>
                  <h2 className="font-display text-base font-semibold text-text-primary">{meta.label}</h2>
                  <span className="rounded-full bg-surface-page px-2 py-0.5 text-[10px] font-bold text-text-muted">
                    {list.length}
                  </span>
                </div>
                <ul className="divide-y divide-border-default">
                  {list.map((task) => (
                    <li key={task.id}>
                      <Link
                        href={task.href}
                        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-page"
                      >
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                            task.priority === 'high' ? 'bg-danger-bg text-danger' :
                            task.priority === 'medium' ? 'bg-warning-bg text-warning' :
                            'bg-surface-page text-text-muted'
                          }`}
                        >
                          {task.priority}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-text-primary">{task.title}</div>
                          <div className="mt-0.5 text-[11px] text-text-muted">{task.description}</div>
                        </div>
                        <span className="shrink-0 text-[10px] text-brand-gold">→</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-lg border border-info/20 bg-info-bg/40 p-3 text-[11px] text-info">
          <strong>How it works.</strong> Tasks are computed from current JD state — status, age, evaluation
          results, and matrix placement. There is no manual task assignment yet (planned for a follow-up).
          Closing a task means resolving the underlying state: approve the JD, run evaluation, place in matrix.
          The list rebuilds on every page load.
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg border border-border-default bg-white p-3 text-center">
      <div className={`font-display text-2xl font-bold ${accent}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
    </div>
  );
}
