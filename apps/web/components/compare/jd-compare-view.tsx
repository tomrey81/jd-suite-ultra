'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { TemplateSection } from '@jd-suite/types';

interface JDSummary {
  id: string;
  jobTitle: string;
  orgUnit?: string;
  status: string;
  updatedAt: string;
}

interface JDFull extends JDSummary {
  sections: TemplateSection[];
  data: Record<string, string>;
  evalResults: { overallScore: number; criteria: any[] }[];
  owner?: { name: string };
  versions?: { timestamp: string }[];
}

const PALETTE = ['#8A7560', '#2D7A4F', '#5B6CB5', '#A0601A'];

const STATUS_STYLES: Record<string, string> = {
  APPROVED:      'bg-green-50 text-green-700 border-green-200',
  DRAFT:         'bg-amber-50 text-amber-700 border-amber-200',
  UNDER_REVISION:'bg-blue-50 text-blue-700 border-blue-200',
  ARCHIVED:      'bg-gray-100 text-gray-500 border-gray-200',
};

export function JDCompareView({
  allJDs,
  initialSelected,
}: {
  allJDs: JDSummary[];
  initialSelected: JDFull[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<JDFull[]>(initialSelected);
  const [loading, setLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState<string>('ALL');
  const [showSelector, setShowSelector] = useState(initialSelected.length === 0);

  const MAX = 4;

  const updateUrl = useCallback((ids: string[]) => {
    const url = ids.length ? `/compare?ids=${ids.join(',')}` : '/compare';
    router.replace(url, { scroll: false });
  }, [router]);

  const addJD = useCallback(async (summary: JDSummary) => {
    if (selected.length >= MAX) return;
    if (selected.some((j) => j.id === summary.id)) return;

    setLoading(summary.id);
    try {
      const res = await fetch(`/api/jd/${summary.id}`);
      if (!res.ok) throw new Error('Failed to load JD');
      const raw = await res.json();
      const jd = raw.jd ?? raw;
      const full: JDFull = {
        ...summary,
        sections: jd.sections ?? [],
        data: jd.data ?? {},
        evalResults: jd.evalResults ?? [],
        owner: jd.owner,
        versions: jd.versions,
      };
      const next = [...selected, full];
      setSelected(next);
      updateUrl(next.map((j) => j.id));
    } finally {
      setLoading(null);
    }
  }, [selected, updateUrl]);

  const removeJD = useCallback((id: string) => {
    const next = selected.filter((j) => j.id !== id);
    setSelected(next);
    updateUrl(next.map((j) => j.id));
  }, [selected, updateUrl]);

  // Collect all unique field IDs across selected JDs
  const allFields = Array.from(
    new Map(
      selected.flatMap((jd) =>
        jd.sections.flatMap((s) =>
          s.fields.map((f) => [f.id, { id: f.id, label: f.label, sectionTitle: s.title, sectionId: s.id }])
        )
      )
    ).values()
  );

  const sections = Array.from(new Set(allFields.map((f) => f.sectionId))).map((sid) => {
    const s = selected[0]?.sections.find((s) => s.id === sid);
    return { id: sid, title: s?.title ?? sid };
  });

  const filteredFields = activeSection === 'ALL'
    ? allFields
    : allFields.filter((f) => f.sectionId === activeSection);

  const filteredJDs = allJDs.filter(
    (j) =>
      !selected.some((s) => s.id === j.id) &&
      (!search || j.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
        (j.orgUnit ?? '').toLowerCase().includes(search.toLowerCase()))
  );

  // Field value comparison helpers
  const hasValue = (jd: JDFull, fieldId: string) => !!(jd.data[fieldId]?.trim());
  const valuesMatch = (fieldId: string) => {
    if (selected.length < 2) return false;
    const vals = selected.map((j) => (j.data[fieldId] ?? '').trim().toLowerCase());
    return vals.every((v) => v === vals[0]);
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Selector sidebar ───────────────────────────────── */}
      {showSelector && (
        <div className="w-[260px] shrink-0 border-r border-border-default bg-surface-page flex flex-col">
          <div className="border-b border-border-default p-4">
            <div className="text-xs font-semibold text-text-primary mb-1">
              Select JDs to compare
              <span className="ml-2 text-text-muted">({selected.length}/{MAX})</span>
            </div>
            <input
              type="search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mt-2 w-full rounded-md border border-border-default bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-gold/40"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredJDs.map((jd) => (
              <button
                key={jd.id}
                type="button"
                disabled={selected.length >= MAX || !!loading}
                onClick={() => addJD(jd)}
                className="w-full rounded-lg border border-border-default bg-white p-2.5 text-left hover:border-brand-gold/50 disabled:opacity-40 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[11px] font-semibold text-text-primary">
                      {loading === jd.id ? (
                        <span className="text-brand-gold">Loading…</span>
                      ) : jd.jobTitle || 'Untitled'}
                    </div>
                    {jd.orgUnit && <div className="text-[9px] text-text-muted truncate">{jd.orgUnit}</div>}
                  </div>
                  <span className={cn('rounded border px-1.5 py-0 text-[8px] font-bold uppercase', STATUS_STYLES[jd.status] ?? 'bg-gray-100 text-gray-500 border-gray-200')}>
                    {jd.status.replace('_', ' ')}
                  </span>
                </div>
              </button>
            ))}
            {filteredJDs.length === 0 && (
              <div className="py-6 text-center text-[10px] text-text-muted">No more JDs</div>
            )}
          </div>
          {selected.length >= 2 && (
            <div className="border-t border-border-default p-3">
              <button
                type="button"
                onClick={() => setShowSelector(false)}
                className="w-full rounded-md bg-surface-nav py-2 text-xs font-semibold text-white"
              >
                Compare {selected.length} JDs →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Main compare area ──────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-2 text-3xl">⇄</div>
              <div className="text-sm font-semibold text-text-primary">Select JDs to compare</div>
              <div className="mt-1 text-xs text-text-muted">Choose 2–4 JDs from the left panel</div>
            </div>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="flex shrink-0 border-b border-border-default bg-white">
              {/* Row label column */}
              <div className="w-[180px] shrink-0 border-r border-border-default px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowSelector(!showSelector)}
                  className="text-xs text-brand-gold hover:underline"
                >
                  {showSelector ? '← Hide selector' : '+ Add JD'}
                </button>
              </div>
              {selected.map((jd, i) => (
                <div
                  key={jd.id}
                  className="flex-1 min-w-[200px] border-r border-border-default px-4 py-3"
                  style={{ borderTopColor: PALETTE[i], borderTopWidth: 3 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/jd/${jd.id}`}
                        className="block truncate text-sm font-bold text-text-primary hover:text-brand-gold transition-colors"
                      >
                        {jd.jobTitle || 'Untitled'}
                      </Link>
                      {jd.orgUnit && (
                        <div className="text-[10px] text-text-muted truncate">{jd.orgUnit}</div>
                      )}
                      <div className="mt-1 flex items-center gap-2">
                        <span className={cn('rounded border px-1.5 py-0 text-[8px] font-bold uppercase', STATUS_STYLES[jd.status] ?? '')}>
                          {jd.status.replace('_', ' ')}
                        </span>
                        {jd.evalResults[0] && (
                          <span className="text-[9px] font-semibold text-text-muted">
                            Score: {jd.evalResults[0].overallScore}%
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeJD(jd.id)}
                      className="shrink-0 text-xs text-text-muted hover:text-danger transition-colors"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Section filter tabs */}
            <div className="flex items-center gap-1 border-b border-border-default bg-surface-page px-4 py-2 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveSection('ALL')}
                className={cn('shrink-0 rounded px-2.5 py-1 text-[10px] font-medium transition-colors', activeSection === 'ALL' ? 'bg-surface-nav text-white' : 'text-text-muted hover:text-text-primary')}
              >
                All fields
              </button>
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveSection(s.id)}
                  className={cn('shrink-0 rounded px-2.5 py-1 text-[10px] font-medium transition-colors', activeSection === s.id ? 'bg-surface-nav text-white' : 'text-text-muted hover:text-text-primary')}
                >
                  {s.title}
                </button>
              ))}
            </div>

            {/* Comparison rows */}
            <div className="flex-1 overflow-y-auto">
              {filteredFields.map((field) => {
                const allFilled = selected.every((j) => hasValue(j, field.id));
                const noneFilled = selected.every((j) => !hasValue(j, field.id));
                const identical = valuesMatch(field.id);

                if (noneFilled) return null;

                return (
                  <div
                    key={field.id}
                    className={cn(
                      'flex border-b border-border-default',
                      identical && selected.length > 1 ? 'bg-green-50/30' : '',
                    )}
                  >
                    {/* Row label */}
                    <div className="w-[180px] shrink-0 border-r border-border-default px-4 py-3">
                      <div className="text-[10px] font-semibold text-text-secondary">{field.label}</div>
                      <div className="text-[9px] text-text-muted mt-0.5">{field.sectionTitle}</div>
                      {identical && selected.length > 1 && (
                        <div className="mt-1 text-[8px] font-bold text-green-600 uppercase tracking-wide">Identical ✓</div>
                      )}
                      {!identical && allFilled && selected.length > 1 && (
                        <div className="mt-1 text-[8px] font-bold text-amber-600 uppercase tracking-wide">Differs</div>
                      )}
                    </div>
                    {/* Value cells */}
                    {selected.map((jd, i) => {
                      const val = jd.data[field.id]?.trim();
                      return (
                        <div
                          key={jd.id}
                          className={cn(
                            'flex-1 min-w-[200px] border-r border-border-default px-4 py-3',
                            !val ? 'bg-surface-page' : '',
                          )}
                        >
                          {val ? (
                            <p className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed">{val}</p>
                          ) : (
                            <span className="text-[10px] italic text-text-muted">— not filled</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Eval results comparison */}
              {selected.some((j) => j.evalResults[0]) && (
                <>
                  <div className="border-b border-border-default bg-surface-page">
                    <div className="flex">
                      <div className="w-[180px] shrink-0 border-r border-border-default px-4 py-2">
                        <div className="text-[9px] font-bold uppercase tracking-wide text-brand-gold">Pay Equity Evaluation</div>
                      </div>
                      {selected.map((jd) => (
                        <div key={jd.id} className="flex-1 min-w-[200px] border-r border-border-default px-4 py-2">
                          {jd.evalResults[0] ? (
                            <div className="flex items-center gap-2">
                              <div className="text-base font-bold">{jd.evalResults[0].overallScore}%</div>
                              <div className="text-[9px] text-text-muted">
                                {jd.evalResults[0].criteria?.filter((c: any) => c.status === 'sufficient').length ?? 0} sufficient ·{' '}
                                {jd.evalResults[0].criteria?.filter((c: any) => c.status === 'insufficient').length ?? 0} gaps
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] italic text-text-muted">Not evaluated</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Export compare */}
            <div className="border-t border-border-default bg-white px-5 py-3 shrink-0 flex items-center justify-between">
              <div className="text-[10px] text-text-muted">
                Comparing {selected.length} JDs · {filteredFields.filter((f) => !selected.every((j) => !hasValue(j, f.id))).length} fields
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-md border border-border-default px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-page"
                >
                  🖨 Print comparison
                </button>
                <Link
                  href={`/pay-groups?compare=${selected.map((j) => j.id).join(',')}`}
                  className="rounded-md bg-brand-gold px-3 py-1.5 text-xs font-semibold text-white"
                >
                  → Pay Groups
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
