import Link from 'next/link';
import { db } from '@jd-suite/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { HubNav } from '@/components/layout/hub-nav';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Job Description hub — JD Suite' };

interface Tile {
  href: string;
  icon: string;
  title: string;
  description: string;
  group: 'input' | 'review' | 'tweak' | 'compare' | 'output';
}

const TILES: Tile[] = [
  // 1. INPUT
  { href: '/jd/input',          icon: '↑',  title: 'Upload Job Description',
    description: 'Paste, upload one file, or drop many at once. Word, PDF, TXT — auto-classified into JD sections.',
    group: 'input' },
  { href: '/jd/new',            icon: '✎',  title: 'Start blank',
    description: 'Open the structured wizard and fill in section by section. Best for new roles.',
    group: 'input' },
  { href: '/sources',           icon: '⊕',  title: 'Live job openings',
    description: 'Adzuna search + scrape careers pages. Save the full JD body to JD Hub in one click.',
    group: 'input' },
  // 2. REVIEW + TWEAK (merged into Job Description Editor)
  { href: '/jd-editor',         icon: '✦',  title: 'Job Description Editor',
    description: 'Edit, lint, bias check, hypothesis test, and AI rewrite — all in one workbench.',
    group: 'tweak' },
  { href: '/templates',         icon: '⊡',  title: 'Job Description Template',
    description: 'Define section structure, required fields, help text, validation rules.',
    group: 'tweak' },
  // 4. COMPARE
  { href: '/jd-versioning',     icon: '⇄',  title: 'Job Descriptions Versioning',
    description: 'Compare versions of one JD or two different JDs side by side.',
    group: 'compare' },
  { href: '/sources',           icon: '⊕',  title: 'Live job openings',
    description: 'Search Adzuna for live openings to benchmark wording, salary, level proxy.',
    group: 'compare' },
  // 5. OUTPUT
  { href: '/audit',             icon: '⊙',  title: 'Audit trail',
    description: 'Every change to every JD with reason codes. Tamper-evident chain.',
    group: 'output' },
];

const GROUP_META: Record<Tile['group'], { label: string; description: string; color: string; emoji: string }> = {
  input:   { emoji: '①', label: 'Input',   description: 'Get a JD into the system',          color: '#8A7560' },
  review:  { emoji: '②', label: 'Review',  description: 'Find what needs work',              color: '#1F6FEB' },
  tweak:   { emoji: '③', label: 'Tweak',   description: 'Improve wording and structure',     color: '#2DA44E' },
  compare: { emoji: '④', label: 'Compare', description: 'Across versions, JDs, and the market', color: '#BC4C00' },
  output:  { emoji: '⑤', label: 'Output',  description: 'Sign-off, audit, export',           color: '#8250DF' },
};

export default async function JDHubPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login?callbackUrl=/jd');

  const membership = await db.membership.findFirst({
    where: { userId: session.user.id },
    orderBy: { org: { createdAt: 'desc' } },
    select: { orgId: true },
  });
  const orgId = membership?.orgId;

  // Quick stats: total, draft, approved
  const stats = orgId
    ? await db.jobDescription.groupBy({
        by: ['status'],
        where: { orgId, archivedAt: null },
        _count: { _all: true },
      })
    : [];
  const total = stats.reduce((a, b) => a + b._count._all, 0);
  const drafts = stats.find((s) => s.status === 'DRAFT')?._count._all ?? 0;
  const approved = stats.find((s) => s.status === 'APPROVED')?._count._all ?? 0;
  const underReview = stats.find((s) => s.status === 'UNDER_REVISION')?._count._all ?? 0;

  // Recent JDs
  const recent = orgId
    ? await db.jobDescription.findMany({
        where: { orgId, archivedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        select: { id: true, jobTitle: true, status: true, updatedAt: true, folder: true },
      })
    : [];

  const grouped: Record<Tile['group'], Tile[]> = { input: [], review: [], tweak: [], compare: [], output: [] };
  for (const t of TILES) grouped[t.group].push(t);

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1100px]">
        <HubNav />

        {/* Header */}
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8A7560]">
          JD Hub · Workflow
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-text-primary">
          Author, audit and ship JDs
        </h1>
        <p className="mt-2 max-w-[680px] text-[14px] leading-relaxed text-text-secondary">
          Everything you need for a job description, in one place. Use the tabs above to switch
          between Workflow steps, your saved Library, or Live Job Openings to import market intel.
        </p>

        {/* Stats strip */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total JDs" value={total} accent="text-text-primary" />
          <Stat label="Drafts" value={drafts} accent="text-warning" />
          <Stat label="Under review" value={underReview} accent="text-info" />
          <Stat label="Approved" value={approved} accent="text-success" />
        </div>

        {/* Recent activity */}
        {recent.length > 0 && (
          <div className="mt-5 rounded-lg border border-border-default bg-white">
            <div className="flex items-center justify-between border-b border-border-default px-4 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Recently edited</div>
              <Link href="/" className="text-[11px] text-brand-gold hover:underline">Library →</Link>
            </div>
            <ul className="divide-y divide-border-default">
              {recent.map((jd) => (
                <li key={jd.id}>
                  <Link href={`/jd/${jd.id}`}
                    className="flex items-center gap-3 px-4 py-2 text-[12px] hover:bg-surface-page">
                    <span className="flex-1 truncate text-text-primary">
                      {jd.jobTitle || <em className="text-text-muted">Untitled</em>}
                    </span>
                    {jd.folder && (
                      <span className="rounded bg-surface-page px-1.5 py-0.5 text-[9px] text-text-muted">{jd.folder}</span>
                    )}
                    <StatusPill status={jd.status} />
                    <span className="text-[10px] text-text-muted">
                      {new Date(jd.updatedAt).toISOString().slice(0, 10)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Workflow tiles, grouped by step */}
        <div className="mt-8 space-y-6">
          {(Object.keys(grouped) as Array<Tile['group']>).map((g) => {
            const meta = GROUP_META[g];
            const tiles = grouped[g];
            return (
              <div key={g}>
                <div className="mb-2 flex items-baseline gap-3">
                  <span className="font-display text-xl font-semibold text-text-primary" style={{ color: meta.color }}>
                    {meta.emoji} {meta.label}
                  </span>
                  <span className="text-[12px] text-text-muted">{meta.description}</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {tiles.map((t) => (
                    <Link key={t.href} href={t.href}
                      className="group flex flex-col gap-1 rounded-lg border border-border-default bg-white p-4 transition-all hover:border-brand-gold hover:shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-base" style={{ color: meta.color }}>{t.icon}</span>
                        <span className="font-display text-[14px] font-semibold text-text-primary group-hover:text-brand-gold">
                          {t.title}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-text-muted">{t.description}</p>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 rounded-lg border border-[#C5D9EF] bg-info-bg p-3.5 text-[11px] leading-relaxed text-info">
          <strong>New here?</strong> Start with <Link href="/jd/input" className="font-semibold underline">Input JD</Link> to bring in existing drafts, then run{' '}
          <Link href="/v5/bias-check" className="font-semibold underline">Bias check</Link>. The audit-grade report is one click away from any open JD.
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

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    DRAFT:           { bg: 'bg-warning-bg', fg: 'text-warning', label: 'Draft' },
    UNDER_REVISION:  { bg: 'bg-info-bg',    fg: 'text-info',    label: 'In review' },
    APPROVED:        { bg: 'bg-success-bg', fg: 'text-success', label: 'Approved' },
    ARCHIVED:        { bg: 'bg-surface-page', fg: 'text-text-muted', label: 'Archived' },
  };
  const c = map[status] || map.DRAFT;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${c.bg} ${c.fg}`}>
      {c.label}
    </span>
  );
}
