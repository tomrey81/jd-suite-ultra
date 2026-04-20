'use client';

import { useEffect, useState, useMemo } from 'react';
import { getEvents, clearEvents, summary, type TelemetryEvent, type TelemetryKind } from '@/lib/telemetry/store';

const KIND_LABEL: Record<TelemetryKind, { label: string; color: string }> = {
  lint:          { label: 'Lint',          color: 'bg-info-bg text-info' },
  rewrite:       { label: 'Rewrite',       color: 'bg-[#FAF6EE] text-brand-gold' },
  compare:       { label: 'Compare',       color: 'bg-[#EDE6F6] text-[#5A3B8C]' },
  studio:        { label: 'Studio',        color: 'bg-[#EAF1E9] text-[#3C6E47]' },
  'notion-sync': { label: 'Notion Sync',   color: 'bg-[#FFF4D6] text-[#946200]' },
  'session-end': { label: 'Session End',   color: 'bg-surface-page text-text-muted' },
};

export function AuditView() {
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [filter, setFilter] = useState<TelemetryKind | 'all'>('all');
  const [sum, setSum] = useState(() => summary());

  const refresh = () => {
    setEvents(getEvents());
    setSum(summary());
  };

  useEffect(() => { refresh(); }, []);

  const filtered = useMemo(
    () => filter === 'all' ? events : events.filter(e => e.kind === filter),
    [events, filter],
  );

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), summary: sum, events }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `audit-trail-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8">
      <div className="mx-auto max-w-[1200px]">
        <h1 className="mb-1 font-display text-2xl font-bold text-text-primary">Audit Trail</h1>
        <p className="mb-6 text-[13px] text-text-secondary">
          Every lint, rewrite, compare and sync action — stored locally in your browser, never sent to our servers.
        </p>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          <SummaryCard label="Total events" value={sum.total} />
          <SummaryCard label="Lint runs" value={sum.byKind.lint || 0} />
          <SummaryCard label="Rewrites" value={sum.byKind.rewrite || 0} />
          <SummaryCard label="Avg. lint score" value={sum.avgLintScore ?? '—'} suffix={sum.avgLintScore !== null ? '/100' : ''} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {(['all', 'lint', 'rewrite', 'compare', 'studio', 'notion-sync'] as const).map(k => (
              <button
                key={k}
                type="button"
                onClick={() => setFilter(k)}
                className={`rounded-full px-3 py-1 text-[11px] ${filter === k ? 'bg-brand-gold text-white' : 'bg-surface-page text-text-secondary'}`}
              >
                {k === 'all' ? 'All' : KIND_LABEL[k as TelemetryKind].label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={refresh} className="rounded-md border border-border-default bg-white px-3 py-1 text-[11px] text-text-primary">
              ↻ Refresh
            </button>
            <button type="button" onClick={exportJson} disabled={events.length === 0} className="rounded-md border border-border-default bg-white px-3 py-1 text-[11px] text-text-primary disabled:opacity-40">
              ↓ JSON
            </button>
            <button
              type="button"
              onClick={() => { if (confirm('Clear all local telemetry?')) { clearEvents(); refresh(); } }}
              className="rounded-md border border-border-default bg-white px-3 py-1 text-[11px] text-danger hover:bg-danger-bg"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-border-default bg-white">
          {filtered.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-text-muted">
              No events yet. Run the Analyser or Editor to start generating audit records.
            </div>
          ) : (
            <div className="divide-y divide-border-default">
              {filtered.map(e => {
                const meta = KIND_LABEL[e.kind];
                return (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-[12px]">
                    <span className="w-32 font-mono text-[10px] text-text-muted">
                      {new Date(e.ts).toLocaleString()}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="min-w-[160px] truncate text-text-primary">{e.jobTitle || <span className="text-text-muted italic">unnamed</span>}</span>
                    {typeof e.score === 'number' && (
                      <span className="font-mono text-[11px] text-text-secondary">
                        {e.score}/100 <span className="text-text-muted">({e.grade})</span>
                      </span>
                    )}
                    {typeof e.delta === 'number' && (
                      <span className={`rounded px-1 text-[10px] font-mono ${e.delta >= 0 ? 'bg-[#E7F5EC] text-[#1D7A3C]' : 'bg-danger-bg text-danger'}`}>
                        {e.delta >= 0 ? '+' : ''}{e.delta}
                      </span>
                    )}
                    {e.meta && (
                      <span className="ml-auto truncate text-[10px] text-text-muted">
                        {Object.entries(e.meta).map(([k, v]) => `${k}=${v}`).join(' · ')}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-white p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className="font-display text-2xl font-bold text-text-primary">{value}</span>
        {suffix && <span className="text-[11px] text-text-muted">{suffix}</span>}
      </div>
    </div>
  );
}
