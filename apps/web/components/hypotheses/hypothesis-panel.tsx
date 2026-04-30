'use client';

import { useState } from 'react';
import {
  HYPOTHESES,
  CATEGORY_LABELS,
  type Hypothesis,
  type HypothesisCategory,
  type HypothesesTestReport,
  type HypothesisResult,
} from '@/lib/hypotheses';
import { cn } from '@/lib/utils';

interface Props {
  /** JD text to test against */
  jdText: string;
  jdId?: string;
  /** Language of hypotheses display */
  language?: 'pl' | 'en';
  /** Compact mode for embedding in narrow panels */
  compact?: boolean;
  /** Optional title override */
  title?: string;
}

export function HypothesisPanel({ jdText, jdId, language = 'pl', compact = false, title }: Props) {
  const [report, setReport] = useState<HypothesesTestReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCat, setExpandedCat] = useState<HypothesisCategory | null>(null);
  const [filter, setFilter] = useState<'all' | 'TRUE' | 'FALSE' | 'UNKNOWN'>('all');

  const run = async () => {
    if (!jdText.trim() || jdText.length < 50) {
      setError('JD text is too short. Add at least a paragraph of content first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/test-hypotheses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jdText, jdId, language }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
      setReport(data);
      setExpandedCat(null);
    } catch (err: any) {
      setError(err.message || 'Hypothesis test failed.');
    } finally {
      setLoading(false);
    }
  };

  const resultMap = report ? new Map(report.results.map((r) => [r.id, r])) : null;
  const filteredHypotheses = (cat: HypothesisCategory): Hypothesis[] => {
    const inCat = HYPOTHESES.filter((h) => h.category === cat);
    if (filter === 'all' || !resultMap) return inCat;
    return inCat.filter((h) => resultMap.get(h.id)?.verdict === filter);
  };

  return (
    <div className="rounded-xl border border-border-default bg-white">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border-default px-4 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-gold">
            Axiomera-style hypothesis test
          </div>
          <h3 className="mt-0.5 font-display text-sm font-semibold text-text-primary">
            {title || `${HYPOTHESES.length}-hypothesis structural fit`}
          </h3>
          <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
            Each hypothesis is evaluated TRUE / FALSE / UNKNOWN against the JD text. UNKNOWN means the JD is silent — not a guess.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading || !jdText.trim()}
          className="shrink-0 rounded-full bg-brand-gold px-4 py-1.5 text-[11px] font-medium text-white transition-colors hover:bg-brand-gold/90 disabled:opacity-40"
        >
          {loading ? 'Testing…' : report ? 'Re-test' : 'Run test'}
        </button>
      </div>

      {error && (
        <div className="border-b border-danger/30 bg-danger-bg p-3 text-xs text-danger">
          {error}
        </div>
      )}

      {!report && !loading && (
        <div className="p-6 text-center">
          <p className="text-xs text-text-muted">
            Click <strong>Run test</strong> to evaluate the JD against the {HYPOTHESES.length} structural hypotheses.
          </p>
          <p className="mt-2 text-[10px] text-text-muted">
            Aligned with EU Pay Transparency Directive 2023/970 + Axiomera/PRISM binary methodology.
          </p>
        </div>
      )}

      {loading && (
        <div className="p-6 text-center">
          <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand-gold/30 border-t-brand-gold" />
          <p className="mt-2 text-xs text-text-muted">Evaluating {HYPOTHESES.length} hypotheses against the JD…</p>
        </div>
      )}

      {report && (
        <>
          {/* Summary bar */}
          <div className={cn('grid gap-2 p-3', compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-4')}>
            <SummaryStat label="Total" value={report.totalHypotheses} color="text-text-primary" onClick={() => setFilter('all')} active={filter === 'all'} />
            <SummaryStat label="TRUE" value={report.trueCount} color="text-success" onClick={() => setFilter('TRUE')} active={filter === 'TRUE'} />
            <SummaryStat label="FALSE" value={report.falseCount} color="text-danger" onClick={() => setFilter('FALSE')} active={filter === 'FALSE'} />
            {!compact && (
              <SummaryStat label="UNKNOWN" value={report.unknownCount} color="text-warning" onClick={() => setFilter('UNKNOWN')} active={filter === 'UNKNOWN'} />
            )}
          </div>

          {/* Category breakdown */}
          <div className="border-t border-border-default">
            {(Object.keys(CATEGORY_LABELS) as HypothesisCategory[])
              .filter((cat) => report.byCategory[cat]?.total > 0)
              .map((cat) => {
                const meta = CATEGORY_LABELS[cat];
                const bucket = report.byCategory[cat];
                const matching = filteredHypotheses(cat);
                if (filter !== 'all' && matching.length === 0) return null;
                const open = expandedCat === cat;
                return (
                  <div key={cat} className="border-b border-border-default last:border-b-0">
                    <button
                      onClick={() => setExpandedCat(open ? null : cat)}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-page"
                    >
                      <span
                        className="inline-block h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: meta.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium text-text-primary">{meta.label}</div>
                        {!compact && (
                          <div className="text-[10px] text-text-muted">{meta.description}</div>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2 text-[10px]">
                        <span className="text-success">{bucket.trueCount}T</span>
                        <span className="text-danger">{bucket.falseCount}F</span>
                        <span className="text-warning">{bucket.unknownCount}?</span>
                        <span className="text-text-muted">/ {bucket.total}</span>
                        <span className="ml-1 font-display text-[12px] font-semibold text-text-primary">
                          {bucket.pctTrue}%
                        </span>
                        <svg width="8" height="8" viewBox="0 0 8 8" className={cn('transition-transform', open ? 'rotate-180' : '')}>
                          <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                        </svg>
                      </div>
                    </button>

                    {/* Progress bar */}
                    <div className="mx-4 mb-2 flex h-1 overflow-hidden rounded-full bg-surface-page">
                      {bucket.trueCount > 0 && (
                        <div
                          className="bg-success"
                          style={{ width: `${(bucket.trueCount / bucket.total) * 100}%` }}
                        />
                      )}
                      {bucket.falseCount > 0 && (
                        <div
                          className="bg-danger"
                          style={{ width: `${(bucket.falseCount / bucket.total) * 100}%` }}
                        />
                      )}
                      {bucket.unknownCount > 0 && (
                        <div
                          className="bg-warning/60"
                          style={{ width: `${(bucket.unknownCount / bucket.total) * 100}%` }}
                        />
                      )}
                    </div>

                    {open && (
                      <ul className="space-y-1.5 px-4 pb-3">
                        {matching.map((h) => {
                          const r = resultMap!.get(h.id);
                          if (!r) return null;
                          return <HypothesisRow key={h.id} hypothesis={h} result={r} />;
                        })}
                        {matching.length === 0 && (
                          <li className="py-2 text-center text-[10px] text-text-muted">
                            No hypotheses in this category match the current filter.
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                );
              })}
          </div>

          <div className="px-4 py-2.5 text-[9px] text-text-muted">
            Tested {new Date(report.testedAt).toLocaleString()} · {report.totalHypotheses} hypotheses · AI analysis (human review required)
          </div>
        </>
      )}
    </div>
  );
}

function SummaryStat({
  label,
  value,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number;
  color: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-lg border px-2 py-2 text-center transition-all',
        active
          ? 'border-brand-gold bg-brand-gold/5'
          : 'border-border-default bg-white hover:border-brand-gold/40',
      )}
    >
      <div className={cn('font-display text-base font-bold', color)}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-text-muted">{label}</div>
    </button>
  );
}

function HypothesisRow({ hypothesis, result }: { hypothesis: Hypothesis; result: HypothesisResult }) {
  const verdictConfig = {
    TRUE: { bg: 'bg-success-bg', fg: 'text-success', label: 'T', border: 'border-success/30' },
    FALSE: { bg: 'bg-danger-bg', fg: 'text-danger', label: 'F', border: 'border-danger/30' },
    UNKNOWN: { bg: 'bg-warning-bg', fg: 'text-warning', label: '?', border: 'border-warning/30' },
  } as const;
  const v = verdictConfig[result.verdict];

  return (
    <li className={cn('rounded-md border bg-white px-2.5 py-2', v.border)}>
      <div className="flex items-start gap-2">
        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold', v.bg, v.fg)}>
          {v.label}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[9px] text-text-muted">#{hypothesis.id}</span>
            <span className="text-[11px] leading-snug text-text-primary">{hypothesis.pl}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[9px] text-text-muted">{hypothesis.key}</span>
            <span className={cn('text-[9px] font-medium', v.fg)}>
              {result.verdict} · {result.confidence}% confidence
            </span>
          </div>
          {result.evidence && (
            <p className="mt-1 line-clamp-2 text-[10px] italic text-text-secondary">
              "{result.evidence}"
            </p>
          )}
          {result.rationale && !result.evidence && (
            <p className="mt-1 text-[10px] text-text-muted">{result.rationale}</p>
          )}
        </div>
      </div>
    </li>
  );
}
